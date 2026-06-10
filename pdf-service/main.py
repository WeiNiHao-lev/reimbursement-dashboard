import copy
import os
import shutil
import subprocess
import tempfile
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import openpyxl
from openpyxl.styles import Alignment
from PyPDF2 import PdfMerger
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Image as RLImage

BASE = Path(__file__).parent
COVER_TEMPLATE = BASE / "CCEPC Template Reimbursement (Cover).xlsx"
SUMMARY_TEMPLATE = BASE / "CCEPC Template Reimbursement (Summary for Page 2).xlsx"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def find_soffice() -> Optional[str]:
    for path in [
        "/usr/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        shutil.which("soffice"),
    ]:
        if path and Path(path).exists():
            return path
    return None


def excel_to_pdf(xlsx_path: Path, out_dir: Path) -> Path:
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError("LibreOffice not found on this server")
    subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(xlsx_path)],
        check=True, capture_output=True, timeout=60,
        env={**os.environ, "HOME": str(out_dir)}
    )
    return out_dir / (xlsx_path.stem + ".pdf")


def _copy_row_style(ws, src_row: int, dst_row: int):
    """Copy cell styles and row height from src_row to dst_row."""
    for col in range(1, ws.max_column + 1):
        src_cell = ws.cell(src_row, col)
        dst_cell = ws.cell(dst_row, col)
        if src_cell.has_style:
            dst_cell.font = copy.copy(src_cell.font)
            dst_cell.border = copy.copy(src_cell.border)
            dst_cell.fill = copy.copy(src_cell.fill)
            dst_cell.number_format = src_cell.number_format
            dst_cell.protection = copy.copy(src_cell.protection)
            dst_cell.alignment = copy.copy(src_cell.alignment)
    if src_row in ws.row_dimensions:
        ws.row_dimensions[dst_row].height = ws.row_dimensions[src_row].height


def _set_wrap(ws, row: int, col: str, value, auto_height: bool = True):
    """Write value to cell with wrap_text enabled."""
    cell = ws[f"{col}{row}"]
    cell.value = value
    existing = cell.alignment
    cell.alignment = Alignment(
        wrap_text=True,
        horizontal=existing.horizontal if existing else None,
        vertical=existing.vertical if existing else "center",
    )
    if auto_height:
        ws.row_dimensions[row].height = None  # auto


def fill_cover(form: dict, out_path: Path):
    wb = openpyxl.load_workbook(COVER_TEMPLATE)
    is_domestic = form.get("tripType") == "domestic"
    active_sheet_name = "差旅费报销明细（境内）" if is_domestic else "差旅费报销明细（境外）"
    hidden_sheet_name = "差旅费报销明细（境外）" if is_domestic else "差旅费报销明细（境内）"

    if hidden_sheet_name in wb.sheetnames:
        del wb[hidden_sheet_name]

    wb.active = wb[active_sheet_name]
    ws = wb.active

    # ── Compute all data first so we know how many rows are needed ──────────
    trip_info = form.get("tripInfo", [])
    accommodation = form.get("accommodation", [])
    receipts = form.get("receipts", [])

    urban_by_route: dict = {}
    intercity_by_route: dict = {}
    for r in receipts:
        if r.get("currency") != "IDR":
            continue
        origin = r.get("origin", "").split(",")[0].strip()
        dest = r.get("destination", "").split(",")[0].strip()
        route = f"{origin} - {dest}" if origin or dest else "Unknown"
        if r.get("category") == "transportation_urban":
            urban_by_route[route] = urban_by_route.get(route, 0) + r.get("amount", 0)
        elif r.get("category") == "transportation_intercity":
            intercity_by_route[route] = intercity_by_route.get(route, 0) + r.get("amount", 0)

    all_transport_keys = list(dict.fromkeys(list(urban_by_route.keys()) + list(intercity_by_route.keys())))

    # ── Template section capacities (row numbers in original template) ───────
    TRIP_START = 7;       TRIP_CAP = 3      # rows 7-9
    TRANSPORT_START = 13; TRANSPORT_CAP = 8  # rows 13-20
    ACCOM_START = 23;     ACCOM_CAP = 3      # rows 23-25
    ALLOWANCE_START = 29                      # rows 29-30

    extra_trip      = max(0, len(trip_info) - TRIP_CAP)
    extra_transport = max(0, len(all_transport_keys) - TRANSPORT_CAP)
    extra_accom     = max(0, len(accommodation) - ACCOM_CAP)

    # ── Insert extra rows from BOTTOM to TOP so earlier row numbers stay valid
    # Accommodation
    if extra_accom > 0:
        insert_at = ACCOM_START + ACCOM_CAP   # after last template accom row
        ws.insert_rows(insert_at, extra_accom)
        for i in range(extra_accom):
            _copy_row_style(ws, insert_at - 1, insert_at + i)

    # Transportation (use original row numbers; accom shift doesn't affect these)
    if extra_transport > 0:
        insert_at = TRANSPORT_START + TRANSPORT_CAP
        ws.insert_rows(insert_at, extra_transport)
        for i in range(extra_transport):
            _copy_row_style(ws, insert_at - 1, insert_at + i)

    # Trip info
    if extra_trip > 0:
        insert_at = TRIP_START + TRIP_CAP
        ws.insert_rows(insert_at, extra_trip)
        for i in range(extra_trip):
            _copy_row_style(ws, insert_at - 1, insert_at + i)

    # ── Recalculate actual start rows after all insertions ───────────────────
    trip_start_r      = TRIP_START
    transport_start_r = TRANSPORT_START + extra_trip
    accom_start_r     = ACCOM_START + extra_trip + extra_transport
    allowance_start_r = ALLOWANCE_START + extra_trip + extra_transport + extra_accom

    # ── Clear old template data in the (now possibly larger) sections ────────
    for row in range(trip_start_r, trip_start_r + max(TRIP_CAP, len(trip_info))):
        for col in ["A", "B", "C", "D"]:
            ws[f"{col}{row}"] = None

    for row in range(transport_start_r, transport_start_r + max(TRANSPORT_CAP, len(all_transport_keys))):
        for col in ["A", "B", "C", "D"]:
            ws[f"{col}{row}"] = None

    for row in range(accom_start_r, accom_start_r + max(ACCOM_CAP, len(accommodation))):
        for col in ["A", "B", "C"]:
            ws[f"{col}{row}"] = None

    for row in range(allowance_start_r, allowance_start_r + 2):
        for col in ["A", "B", "C", "D"]:
            ws[f"{col}{row}"] = None

    # ── Header fields ─────────────────────────────────────────────────────────
    ws["A3"] = f"员工姓名(Name)：{form.get('employeeName', '')}"
    ws["C3"] = f"部门(Apartment)：{form.get('department', '')}"
    ws["A4"] = f"常驻地(Permanent Residence)：{form.get('permanentResidence', '')}"
    ws["C4"] = f"出差事由(Purpose of Business Trip): {form.get('purpose', '')}"

    # ── Trip info ─────────────────────────────────────────────────────────────
    for i, t in enumerate(trip_info):
        row = trip_start_r + i
        depart = t.get("date", "")
        arrive = t.get("arriveDate", "") or ""
        try:
            d1_str = datetime.fromisoformat(depart).strftime("%d-%b-%Y") if depart else ""
            d2_str = datetime.fromisoformat(arrive).strftime("%d-%b-%Y") if arrive and arrive != depart else ""
            date_str = f"{d1_str} - {d2_str}" if d2_str else d1_str
        except Exception:
            date_str = depart
        ws[f"A{row}"] = date_str
        _set_wrap(ws, row, "B", f"{t.get('origin', '')} - {t.get('destination', '')}")
        ws[f"C{row}"] = t.get("vehicle", "")
        ws[f"D{row}"] = t.get("ticketingMethod", "")

    # ── Transportation ────────────────────────────────────────────────────────
    for i, key in enumerate(all_transport_keys):
        row = transport_start_r + i
        _set_wrap(ws, row, "A", key)
        ws[f"B{row}"] = intercity_by_route.get(key, 0) or 0
        ws[f"C{row}"] = urban_by_route.get(key, 0) or 0
        ws[f"D{row}"] = f"=B{row}+C{row}"

    # ── Accommodation ─────────────────────────────────────────────────────────
    for i, a in enumerate(accommodation):
        row = accom_start_r + i
        ws[f"A{row}"] = a.get("location", "")
        ws[f"B{row}"] = a.get("days", 0)
        ws[f"C{row}"] = a.get("amount", 0)

    # ── Allowance ─────────────────────────────────────────────────────────────
    start_date = form.get("allowanceStartDate") or ""
    end_date   = form.get("allowanceEndDate") or ""
    daily      = form.get("mealAllowanceDailyIDR", 200000)

    if not start_date or not end_date:
        all_dates = sorted(
            [r.get("date", "") for r in form.get("receipts", [])] +
            [t.get("date", "") for t in form.get("tripInfo", [])]
        )
        all_dates = [d for d in all_dates if d]
        if all_dates:
            start_date = start_date or all_dates[0]
            end_date   = end_date or all_dates[-1]

    r_allow = allowance_start_r
    if start_date:
        try:
            ws[f"A{r_allow}"] = datetime.fromisoformat(start_date)
            ws[f"A{r_allow}"].number_format = "DD-MMM-YYYY"
        except Exception:
            ws[f"A{r_allow}"] = start_date

    if end_date:
        try:
            ws[f"B{r_allow}"] = datetime.fromisoformat(end_date)
            ws[f"B{r_allow}"].number_format = "DD-MMM-YYYY"
        except Exception:
            ws[f"B{r_allow}"] = end_date

    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(start_date)
            d2 = datetime.fromisoformat(end_date)
            days = max((d2 - d1).days + 1, 1)
            ws[f"C{r_allow}"] = days
            ws[f"D{r_allow}"] = days * daily
        except Exception:
            pass

    wb.save(out_path)


def fill_summary(form: dict, out_path: Path):
    wb = openpyxl.load_workbook(SUMMARY_TEMPLATE)
    ws = wb.active

    from openpyxl.worksheet.page import PageMargins
    from openpyxl.worksheet.properties import WorksheetProperties, PageSetupProperties
    if ws.sheet_properties is None:
        ws.sheet_properties = WorksheetProperties()
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_setup.paperSize = 9
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.75, bottom=0.75)

    # Header info
    ws["B2"] = form.get("department", "")
    ws["F2"] = form.get("month", "")

    receipts = sorted(form.get("receipts", []), key=lambda r: r.get("date", ""))

    # ── Expand rows if more receipts than template capacity (9 rows: 4-12) ───
    RECEIPT_START = 4
    RECEIPT_CAP = 9   # rows 4-12
    TOTAL_ROW_ORIG = 13
    PREPARER_ROW_ORIG = 16

    extra_receipts = max(0, len(receipts) - RECEIPT_CAP)

    if extra_receipts > 0:
        insert_at = RECEIPT_START + RECEIPT_CAP  # row 13 originally
        ws.insert_rows(insert_at, extra_receipts)
        for i in range(extra_receipts):
            _copy_row_style(ws, insert_at - 1, insert_at + i)

    total_row     = TOTAL_ROW_ORIG + extra_receipts
    preparer_row  = PREPARER_ROW_ORIG + extra_receipts

    # Clear all data rows
    for row in range(RECEIPT_START, RECEIPT_START + max(RECEIPT_CAP, len(receipts))):
        for col in ["A", "B", "C", "D", "E", "F", "G", "H"]:
            ws[f"{col}{row}"] = None

    category_label = {
        "transportation_intercity": "交通费(城市间)",
        "transportation_urban": "交通费(市内)",
        "accommodation": "住宿费",
        "other": "其他",
    }

    for i, r in enumerate(receipts):
        row = RECEIPT_START + i
        ws[f"A{row}"] = i + 1
        ws[f"B{row}"] = form.get("employeeName", "")
        try:
            ws[f"C{row}"] = datetime.fromisoformat(r.get("date", ""))
            ws[f"C{row}"].number_format = "DD-MMM-YYYY"
        except Exception:
            ws[f"C{row}"] = r.get("date", "")
        ws[f"D{row}"] = category_label.get(r.get("category", ""), r.get("category", ""))
        ws[f"E{row}"] = r.get("currency", "IDR")
        ws[f"F{row}"] = r.get("amount", 0)

        vendor    = r.get("vendor", "")
        origin    = r.get("origin", "").split(",")[0].strip()
        dest      = r.get("destination", "").split(",")[0].strip()
        reason    = r.get("description", "").strip()
        route_str = f"{origin} - {dest}" if (origin or dest) else ""

        if vendor and route_str:
            note = f"{vendor} ({route_str})"
        elif vendor:
            note = vendor
        elif route_str:
            note = route_str
        else:
            note = ""
        if reason:
            note = f"{note}; {reason}" if note else reason

        # Write remarks with wrap_text so long text is not clipped
        _set_wrap(ws, row, "H", note)

    # Total formula
    last_data_row = RECEIPT_START + len(receipts) - 1 if receipts else RECEIPT_START
    ws[f"F{total_row}"] = f"=SUM(F{RECEIPT_START}:F{last_data_row})"

    # Preparer
    ws[f"G{preparer_row}"] = f"制表人: {form.get('employeeName', '')}"
    ws[f"H{preparer_row}"] = "审核人:"

    wb.save(out_path)


def image_to_pdf(img_path: Path, pdf_path: Path):
    img = Image.open(img_path).convert("RGB")
    iw, ih = img.size
    aw, ah = A4
    scale = min((aw - 2*cm) / iw, (ah - 2*cm) / ih) * 72 / 96
    rw = min(iw * scale, aw - 2*cm)
    rh = min(ih * scale, ah - 2*cm)
    doc = SimpleDocTemplate(str(pdf_path), pagesize=A4,
                            leftMargin=1*cm, rightMargin=1*cm,
                            topMargin=1*cm, bottomMargin=1*cm)
    doc.build([RLImage(str(img_path), width=rw, height=rh)])


@app.get("/health")
def health():
    soffice = find_soffice()
    return {"status": "ok", "libreoffice": soffice or "not found"}


@app.post("/generate-pdf")
async def generate_pdf(
    form: str = Form(...),
    files: List[UploadFile] = File(default=[]),
):
    form_data = json.loads(form)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        cover_xlsx = tmp / "cover.xlsx"
        summary_xlsx = tmp / "summary.xlsx"
        fill_cover(form_data, cover_xlsx)
        fill_summary(form_data, summary_xlsx)

        cover_pdf = excel_to_pdf(cover_xlsx, tmp)
        summary_pdf = excel_to_pdf(summary_xlsx, tmp)

        receipt_pdfs = []
        for i, upload in enumerate(files):
            ext = Path(upload.filename or "file").suffix.lower()
            raw_path = tmp / f"receipt_{i}{ext}"
            content = await upload.read()
            raw_path.write_bytes(content)

            if ext in (".jpg", ".jpeg", ".png", ".webp"):
                pdf_path = tmp / f"receipt_{i}.pdf"
                image_to_pdf(raw_path, pdf_path)
                receipt_pdfs.append(pdf_path)
            elif ext == ".pdf":
                receipt_pdfs.append(raw_path)

        merger = PdfMerger()
        merger.append(str(cover_pdf))
        merger.append(str(summary_pdf))
        for rp in receipt_pdfs:
            merger.append(str(rp))

        out_pdf = tmp / "output.pdf"
        merger.write(str(out_pdf))
        merger.close()

        pdf_bytes = out_pdf.read_bytes()

    month = form_data.get("month", "Reimbursement")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Reimbursement {month}.pdf"'},
    )
