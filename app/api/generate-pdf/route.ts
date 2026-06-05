import { NextRequest, NextResponse } from "next/server";
import { ReimbursementForm } from "@/lib/types";
import { groupExpenses, sumIDR, computeAllowance, formatIDR, formatDate } from "@/lib/pdf-generator";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";

// Helper: draw text with optional bold
async function buildPDF(form: ReimbursementForm, receiptFiles: { name: string; data: Uint8Array; mimeType: string }[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { intercity, urban, accommodation } = groupExpenses(form.receipts);
  const allowance = computeAllowance(form);

  // ── PAGE 1: COVER ────────────────────────────────────────────────────────────
  const cover = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = cover.getSize();
  let y = height - 40;
  const L = 40;
  const R = width - 40;
  const col2 = width / 2;

  const line = (y2: number) => cover.drawLine({ start: { x: L, y: y2 }, end: { x: R, y: y2 }, thickness: 0.5, color: rgb(0, 0, 0) });
  const text = (t: string, x: number, yy: number, size = 9, bold = false) =>
    cover.drawText(t, { x, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });

  // Title
  const title = form.tripType === "domestic"
    ? "差旅费报销单-境内 / Business Trip Reimbursement Form-Domestic"
    : "差旅费报销单-境外 / Business Trip Reimbursement Form-Overseas";
  text(title, L, y, 11, true);
  y -= 20;

  // Basic info
  line(y); y -= 14;
  text("基础信息 / Basic Information", L, y, 9, true); y -= 14;
  text(`员工姓名(Name): ${form.employeeName}`, L, y);
  text(`部门(Dept): ${form.department}`, col2, y); y -= 14;
  text(`常驻地(Residence): ${form.permanentResidence}`, L, y);
  text(`出差事由(Purpose): ${form.purpose}`, col2, y); y -= 8;
  line(y); y -= 14;

  // Trip info
  text("出差信息 / Business Trip Information", L, y, 9, true); y -= 14;
  text("出发-到达日期", L, y, 8, true);
  text("出发地-目的地", L + 120, y, 8, true);
  text("交通工具", L + 250, y, 8, true);
  text("购票途径", L + 340, y, 8, true);
  y -= 12;
  for (const t of form.tripInfo.slice(0, 4)) {
    text(formatDate(t.date), L, y, 8);
    text(`${t.origin} → ${t.destination}`, L + 120, y, 8);
    text(t.vehicle, L + 250, y, 8);
    text(t.ticketingMethod, L + 340, y, 8);
    y -= 12;
  }
  line(y); y -= 14;

  // Transportation expenses
  text("交通费用 / Transportation Expenses", L, y, 9, true); y -= 14;
  text("出发地-目的地", L, y, 8, true);
  text("城市间交通费(Inter-city)", L + 160, y, 8, true);
  text("市内交通费(Urban)", L + 290, y, 8, true);
  text("合计(Total)", L + 400, y, 8, true);
  y -= 12;

  // Group urban by city
  const urbanByCity: Record<string, number> = {};
  for (const r of urban) {
    const city = r.destination?.split(",")[0] || r.origin?.split(",")[0] || "Unknown";
    urbanByCity[city] = (urbanByCity[city] || 0) + (r.currency === "IDR" ? r.amount : 0);
  }
  const intercityByRoute: Record<string, number> = {};
  for (const r of intercity) {
    const route = `${r.origin || ""} - ${r.destination || ""}`;
    intercityByRoute[route] = (intercityByRoute[route] || 0) + (r.currency === "IDR" ? r.amount : 0);
  }

  const allRoutes = new Set([...Object.keys(urbanByCity), ...Object.keys(intercityByRoute)]);
  for (const route of Array.from(allRoutes).slice(0, 6)) {
    const inter = intercityByRoute[route] || 0;
    const urb = urbanByCity[route] || 0;
    const total = inter + urb;
    text(route, L, y, 8);
    text(inter > 0 ? formatIDR(inter) : "-", L + 160, y, 8);
    text(urb > 0 ? formatIDR(urb) : "-", L + 290, y, 8);
    text(formatIDR(total), L + 400, y, 8);
    y -= 12;
  }
  line(y); y -= 14;

  // Accommodation
  text("住宿费用 / Accommodation Expenses", L, y, 9, true); y -= 14;
  text("发生地(Location)", L, y, 8, true);
  text("住宿天数(Days)", L + 160, y, 8, true);
  text("报销金额(Amount)", L + 270, y, 8, true);
  y -= 12;
  for (const a of form.accommodation.slice(0, 4)) {
    text(a.location, L, y, 8);
    text(String(a.days), L + 160, y, 8);
    text(formatIDR(a.amount), L + 270, y, 8);
    y -= 12;
  }
  if (accommodation.length > 0 && form.accommodation.length === 0) {
    for (const a of accommodation.slice(0, 4)) {
      text(a.destination || a.origin || "-", L, y, 8);
      text("-", L + 160, y, 8);
      text(formatIDR(a.amount), L + 270, y, 8);
      y -= 12;
    }
  }
  line(y); y -= 14;

  // Allowance
  text("补贴信息 / Allowance Information", L, y, 9, true); y -= 14;
  text("伙食费补贴 (Meal Allowance) IDR 200/day", L, y, 8, true); y -= 12;
  text("补贴日期起(Start)", L, y, 8, true);
  text("补贴日期止(End)", L + 130, y, 8, true);
  text("天数(Days)", L + 260, y, 8, true);
  text("金额(Amount)", L + 340, y, 8, true);
  y -= 12;
  text(formatDate(allowance.startDate), L, y, 8);
  text(formatDate(allowance.endDate), L + 130, y, 8);
  text(String(allowance.days), L + 260, y, 8);
  text(formatIDR(allowance.mealAmount), L + 340, y, 8);
  y -= 16;
  line(y); y -= 14;

  // Total
  const intercityTotal = sumIDR(intercity);
  const urbanTotal = sumIDR(urban);
  const accommTotal = form.accommodation.reduce((s, a) => s + a.amount, 0);
  const grandTotal = intercityTotal + urbanTotal + accommTotal + allowance.mealAmount;
  text("实际报销总金额 / Total Reimbursement:", L, y, 10, true);
  text(formatIDR(grandTotal), L + 230, y, 10, true);
  y -= 20;

  // Approval
  line(y); y -= 14;
  text("领导审批 / Approval:", L, y, 9, true);
  text("___________________________________", L + 120, y, 9);
  y -= 30;
  if (form.remarks) {
    text(`备注(Remarks): ${form.remarks}`, L, y, 8);
  }

  // ── PAGE 2: SUMMARY ─────────────────────────────────────────────────────────
  const summary = pdfDoc.addPage(PageSizes.A4);
  const sw = summary.getSize().width;
  let sy = summary.getSize().height - 40;
  const sL = 30;

  const stext = (t: string, x: number, yy: number, size = 8, bold = false) =>
    summary.drawText(String(t), { x, y: yy, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
  const sline = (yy: number) =>
    summary.drawLine({ start: { x: sL, y: yy }, end: { x: sw - 30, y: yy }, thickness: 0.5, color: rgb(0, 0, 0) });

  stext("境内一般性开支明细表 / Domestic Daily Expenses List", sL, sy, 11, true); sy -= 18;
  stext(`部门: ${form.department}`, sL, sy, 8);
  stext(`月份: ${form.month}`, sL + 180, sy, 8);
  sy -= 14;

  // Header row
  const cols = [sL, sL + 20, sL + 80, sL + 155, sL + 260, sL + 330, sL + 400];
  stext("序号", cols[0], sy, 8, true);
  stext("姓名(Name)", cols[1], sy, 8, true);
  stext("日期(Date)", cols[2], sy, 8, true);
  stext("费用类型(Type)", cols[3], sy, 8, true);
  stext("币种", cols[4], sy, 8, true);
  stext("金额(Amount)", cols[5], sy, 8, true);
  stext("备注(Remarks)", cols[6], sy, 8, true);
  sy -= 12;
  sline(sy); sy -= 4;

  const categoryLabel: Record<string, string> = {
    transportation_intercity: "交通费(城市间)",
    transportation_urban: "交通费(市内)",
    accommodation: "住宿费",
    other: "其他",
  };

  const allReceipts = [...form.receipts].sort((a, b) => a.date.localeCompare(b.date));
  allReceipts.forEach((r, i) => {
    sy -= 12;
    stext(String(i + 1), cols[0], sy, 8);
    stext(form.employeeName, cols[1], sy, 8);
    stext(formatDate(r.date), cols[2], sy, 8);
    stext(categoryLabel[r.category] || r.category, cols[3], sy, 8);
    stext(r.currency, cols[4], sy, 8);
    stext(r.amount.toLocaleString("id-ID"), cols[5], sy, 8);
    const note = r.vendor ? `${r.vendor}: ${r.origin || ""} → ${r.destination || ""}` : r.description;
    stext(note.substring(0, 40), cols[6], sy, 7);
  });

  sy -= 16;
  sline(sy); sy -= 12;
  stext("合计(Total):", cols[3], sy, 9, true);
  stext(formatIDR(sumIDR(form.receipts)), cols[5], sy, 9, true);

  sy -= 20;
  stext(`制表人: ${form.employeeName}`, sL, sy, 8);
  stext("审核人: _______________", sL + 200, sy, 8);

  // ── RECEIPT PAGES ────────────────────────────────────────────────────────────
  for (const receiptFile of receiptFiles) {
    try {
      let embeddedImage;
      if (receiptFile.mimeType === "image/jpeg" || receiptFile.mimeType === "image/jpg") {
        embeddedImage = await pdfDoc.embedJpg(receiptFile.data);
      } else if (receiptFile.mimeType === "image/png") {
        embeddedImage = await pdfDoc.embedPng(receiptFile.data);
      } else {
        // For PDFs, embed existing PDF pages
        try {
          const srcDoc = await PDFDocument.load(receiptFile.data);
          const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => pdfDoc.addPage(p));
        } catch {
          // skip unparseable
        }
        continue;
      }
      const imgPage = pdfDoc.addPage(PageSizes.A4);
      const { width: pw, height: ph } = imgPage.getSize();
      const margin = 30;
      const maxW = pw - margin * 2;
      const maxH = ph - margin * 2 - 20;
      const { width: iw, height: ih } = embeddedImage;
      const scale = Math.min(maxW / iw, maxH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const xOffset = (pw - drawW) / 2;
      const yOffset = (ph - drawH) / 2;
      imgPage.drawImage(embeddedImage, { x: xOffset, y: yOffset, width: drawW, height: drawH });

      // Label
      imgPage.drawText(receiptFile.name, { x: margin, y: ph - 20, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    } catch {
      // skip individual receipt errors
    }
  }

  return await pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const formJson = formData.get("form") as string;
    const form: ReimbursementForm = JSON.parse(formJson);

    const receiptFiles: { name: string; data: Uint8Array; mimeType: string }[] = [];
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (key.startsWith("receipt_") && value instanceof File) {
        const ab = await value.arrayBuffer();
        receiptFiles.push({
          name: value.name,
          data: new Uint8Array(ab),
          mimeType: value.type,
        });
      }
    }

    const pdfBytes = await buildPDF(form, receiptFiles);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Reimbursement ${form.month}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
