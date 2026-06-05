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
        env={**os.environ, "HOME": str(out_dir)}  # avoid lock file issues
    )
    return out_dir / (xlsx_path.stem + ".pdf")


def fill_cover(form: dict, out_path: Path):
    wb = openpyxl.load_workbook(COVER_TEMPLATE)
    is_domestic = form.get("tripType") == "domestic"
    active_sheet_name = "差旅费报销明细（境内）" if is_domestic else "差旅费报销明细（境外）"
    hidden_sheet_name = "差旅费报销明细（境外）" if is_domestic else "差旅费报销明细（境内）"

    # Delete the unused sheet so LibreOffice only prints the active one
    if hidden_sheet_name in wb.sheetnames:
        del wb[hidden_sheet_name]

    # Set active sheet
    wb.active = wb[active_sheet_name]
    ws = wb.active

    # Purpose
    ws["C4"] = f"出差事由(Purpose of Business Trip): {form.get('purpose', '')}"

    # Trip info rows (starting row 7)
    # Date cell: "07-May-2026" if same day, "07-May-2026 - 09-May-2026" if different
    trip_info = form.get("tripInfo", [])
    for i, t in enumerate(trip_info[:3]):
        row = 7 + i
        depart = t.get("date", "")
        arrive = t.get("arriveDate", "") or ""
        # Build date string
        try:
            d1_str = datetime.fromisoformat(depart).strftime("%d-%b-%Y") if depart else ""
            d2_str = datetime.fromisoformat(arrive).strftime("%d-%b-%Y") if arrive and arrive != depart else ""
            date_str = f"{d1_str} - {d2_str}" if d2_str else d1_str
        except Exception:
            date_str = depart
        ws[f"A{row}"] = date_str
        ws[f"B{row}"] = f"{t.get('origin', '')} - {t.get('destination', '')}"
        ws[f"C{row}"] = t.get("vehicle", "")
        ws[f"D{row}"] = t.get("ticketingMethod", "")

    # Transportation expenses — group by full route (origin - destination)
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

    all_keys = list(dict.fromkeys(list(urban_by_route.keys()) + list(intercity_by_route.keys())))
    for i, key in enumerate(all_keys[:6]):
        row = 13 + i
        ws[f"A{row}"] = key
        ws[f"B{row}"] = intercity_by_route.get(key, 0) or 0
        ws[f"C{row}"] = urban_by_route.get(key, 0) or 0
        ws[f"D{row}"] = f"=B{row}+C{row}"

    # Accommodation
    for r in ws.merged_cells.ranges:
        pass  # just ensure merges stay intact
    accommodation = form.get("accommodation", [])
    ws["A23"] = None
    ws["B23"] = None
    ws["C23"] = None
    for i, a in enumerate(accommodation[:3]):
        row = 23 + i
        ws[f"A{row}"] = a.get("location", "")
        ws[f"B{row}"] = a.get("days", 0)
        ws[f"C{row}"] = a.get("amount", 0)

    # Allowance — use override dates if provided, else auto-detect from receipts/tripInfo
    start_date = form.get("allowanceStartDate") or ""
    end_date = form.get("allowanceEndDate") or ""
    daily = form.get("mealAllowanceDailyIDR", 200000)

    if not start_date or not end_date:
        all_dates = sorted([
            r.get("date", "") for r in form.get("receipts", [])
        ] + [
            t.get("date", "") for t in form.get("tripInfo", [])
        ])
        all_dates = [d for d in all_dates if d]
        if all_dates:
            start_date = start_date or all_dates[0]
            end_date = end_date or all_dates[-1]

    if start_date:
        try:
            ws["A29"] = datetime.fromisoformat(start_date)
            ws["A29"].number_format = "DD-MMM-YYYY"
        except Exception:
            ws["A29"] = start_date

    if end_date:
        try:
            ws["B29"] = datetime.fromisoformat(end_date)
            ws["B29"].number_format = "DD-MMM-YYYY"
        except Exception:
            ws["B29"] = end_date

    # Days and amount — always compute if we have both dates
    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(start_date)
            d2 = datetime.fromisoformat(end_date)
            days = max((d2 - d1).days + 1, 1)
            ws["C29"] = days
            ws["D29"] = days * daily
        except Exception:
            pass

    wb.save(out_path)


def fill_summary(form: dict, out_path: Path):
    wb = openpyxl.load_workbook(SUMMARY_TEMPLATE)
    ws = wb.active

    # Fix page setup: fit all columns on one page, A4 landscape
    from openpyxl.worksheet.page import PageMargins, PrintPageSetup
    from openpyxl.worksheet.properties import WorksheetProperties, PageSetupProperties
    if ws.sheet_properties is None:
        ws.sheet_properties = WorksheetProperties()
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_setup.paperSize = 9  # A4
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.75, bottom=0.75)

    # Project number, form number
    ws["F2"] = form.get("month", "")

    receipts = sorted(form.get("receipts", []), key=lambda r: r.get("date", ""))
    category_label = {
        "transportation_intercity": "交通费(城市间)",
        "transportation_urban": "交通费(市内)",
        "accommodation": "住宿费",
        "other": "其他",
    }

    for i, r in enumerate(receipts):
        row = 4 + i
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
        vendor = r.get("vendor", "")
        origin = r.get("origin", "").split(",")[0].strip()
        dest = r.get("destination", "").split(",")[0].strip()
        route_str = f"{origin} -> {dest}" if (origin or dest) else ""
        if vendor and route_str:
            note = f"{vendor}: {route_str}"
        elif vendor:
            note = vendor
        elif route_str:
            note = route_str
        else:
            note = r.get("description", "")
        ws[f"H{row}"] = note[:80]

    # Update total formula range
    last_row = 4 + len(receipts) - 1 if receipts else 4
    ws["F13"] = f"=SUM(F4:F{last_row})"

    # Preparer
    ws["G16"] = f"制表人: {form.get('employeeName', '')}"

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

        # 1. Fill Excel templates
        cover_xlsx = tmp / "cover.xlsx"
        summary_xlsx = tmp / "summary.xlsx"
        fill_cover(form_data, cover_xlsx)
        fill_summary(form_data, summary_xlsx)

        # 2. Convert Excel to PDF
        cover_pdf = excel_to_pdf(cover_xlsx, tmp)
        summary_pdf = excel_to_pdf(summary_xlsx, tmp)

        # 3. Save receipt files and convert images to PDF
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

        # 4. Merge all PDFs
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
