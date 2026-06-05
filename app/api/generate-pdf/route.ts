import { NextRequest, NextResponse } from "next/server";
import { ReimbursementForm } from "@/lib/types";
import { groupExpenses, sumIDR, computeAllowance, formatIDR, formatDate } from "@/lib/pdf-generator";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";

async function buildPDF(form: ReimbursementForm, receiptFiles: { name: string; data: Uint8Array; mimeType: string }[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { intercity, urban, accommodation } = groupExpenses(form.receipts);
  const allowance = computeAllowance(form);

  // Sanitize: strip anything outside WinAnsi printable range, replace common symbols
  const safe = (s: string) =>
    s
      .replace(/—/g, "-")   // em dash
      .replace(/–/g, "-")   // en dash
      .replace(/→/g, "->")  // arrow
      .replace(/×/g, "x")   // multiplication sign
      .replace(/[^\x20-\x7E]/g, "") // strip remaining non-printable / non-ASCII
      .trim();

  // ── PAGE 1: COVER ────────────────────────────────────────────────────────────
  const cover = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = cover.getSize();
  let y = height - 40;
  const L = 40;
  const R = width - 40;
  const col2 = width / 2;
  const indigo = rgb(0.306, 0.275, 0.898);
  const slate = rgb(0.44, 0.5, 0.56);

  const line = (y2: number, color = rgb(0.8, 0.8, 0.8)) =>
    cover.drawLine({ start: { x: L, y: y2 }, end: { x: R, y: y2 }, thickness: 0.5, color });

  const text = (t: string, x: number, yy: number, size = 9, bold = false, color = rgb(0, 0, 0)) =>
    cover.drawText(safe(t), { x, y: yy, size, font: bold ? fontBold : font, color });

  // Header bar
  cover.drawRectangle({ x: 0, y: height - 52, width, height: 52, color: indigo });
  cover.drawText(
    safe(form.tripType === "domestic"
      ? "Business Trip Reimbursement Form - Domestic"
      : "Business Trip Reimbursement Form - Overseas"),
    { x: L, y: height - 34, size: 13, font: fontBold, color: rgb(1, 1, 1) }
  );
  cover.drawText(safe("CCEPC Marketing Department"), { x: L, y: height - 48, size: 8, font, color: rgb(0.8, 0.85, 1) });
  y = height - 70;

  // Section: Basic Information
  text("BASIC INFORMATION", L, y, 7, true, slate); y -= 14;
  text(`Name: ${form.employeeName}`, L, y);
  text(`Department: ${form.department}`, col2, y); y -= 13;
  text(`Permanent Residence: ${form.permanentResidence}`, L, y);
  text(`Period: ${form.month}`, col2, y); y -= 13;
  text(`Purpose: ${form.purpose}`, L, y); y -= 8;
  line(y); y -= 16;

  // Section: Trip Routes
  text("TRIP ROUTES", L, y, 7, true, slate); y -= 14;
  text("Date", L, y, 8, true, slate);
  text("Route", L + 90, y, 8, true, slate);
  text("Vehicle", L + 270, y, 8, true, slate);
  text("Ticketing", L + 340, y, 8, true, slate);
  y -= 4;
  line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  for (const t of form.tripInfo.slice(0, 4)) {
    text(formatDate(t.date), L, y, 8);
    text(safe(`${t.origin} -> ${t.destination}`), L + 90, y, 8);
    text(t.vehicle, L + 270, y, 8);
    text(t.ticketingMethod, L + 340, y, 8);
    y -= 12;
  }
  if (form.tripInfo.length === 0) { text("—", L, y, 8, false, slate); y -= 12; }
  line(y); y -= 16;

  // Section: Transportation Expenses
  text("TRANSPORTATION EXPENSES", L, y, 7, true, slate); y -= 14;
  text("Route / City", L, y, 8, true, slate);
  text("Inter-city (IDR)", L + 180, y, 8, true, slate);
  text("Urban (IDR)", L + 300, y, 8, true, slate);
  text("Total (IDR)", L + 400, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;

  const urbanByCity: Record<string, number> = {};
  for (const r of urban) {
    const city = r.destination?.split(",")[0] || r.origin?.split(",")[0] || "Unknown";
    urbanByCity[safe(city)] = (urbanByCity[safe(city)] || 0) + (r.currency === "IDR" ? r.amount : 0);
  }
  const intercityByRoute: Record<string, number> = {};
  for (const r of intercity) {
    const route = safe(`${r.origin || ""} - ${r.destination || ""}`);
    intercityByRoute[route] = (intercityByRoute[route] || 0) + (r.currency === "IDR" ? r.amount : 0);
  }
  const allRoutes = new Set([...Object.keys(urbanByCity), ...Object.keys(intercityByRoute)]);
  for (const route of Array.from(allRoutes).slice(0, 6)) {
    const inter = intercityByRoute[route] || 0;
    const urb = urbanByCity[route] || 0;
    text(route || "—", L, y, 8);
    text(inter > 0 ? formatIDR(inter) : "—", L + 180, y, 8);
    text(urb > 0 ? formatIDR(urb) : "—", L + 300, y, 8);
    text(formatIDR(inter + urb), L + 400, y, 8);
    y -= 12;
  }
  if (allRoutes.size === 0) { text("—", L, y, 8, false, slate); y -= 12; }
  line(y); y -= 16;

  // Section: Accommodation
  text("ACCOMMODATION EXPENSES", L, y, 7, true, slate); y -= 14;
  text("Location", L, y, 8, true, slate);
  text("Nights", L + 200, y, 8, true, slate);
  text("Amount (IDR)", L + 280, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  for (const a of form.accommodation.slice(0, 4)) {
    text(safe(a.location), L, y, 8);
    text(String(a.days), L + 200, y, 8);
    text(formatIDR(a.amount), L + 280, y, 8);
    y -= 12;
  }
  if (accommodation.length > 0 && form.accommodation.length === 0) {
    for (const a of accommodation.slice(0, 4)) {
      text(safe(a.destination || a.origin || "—"), L, y, 8);
      text("—", L + 200, y, 8);
      text(formatIDR(a.amount), L + 280, y, 8);
      y -= 12;
    }
  }
  if (form.accommodation.length === 0 && accommodation.length === 0) {
    text("—", L, y, 8, false, slate); y -= 12;
  }
  line(y); y -= 16;

  // Section: Allowance
  text("ALLOWANCE INFORMATION", L, y, 7, true, slate); y -= 14;
  text("Meal Allowance  IDR 200,000/day", L, y, 8, true); y -= 12;
  text("Start Date", L, y, 8, true, slate);
  text("End Date", L + 130, y, 8, true, slate);
  text("Days", L + 260, y, 8, true, slate);
  text("Total Amount", L + 330, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  text(formatDate(allowance.startDate), L, y, 8);
  text(formatDate(allowance.endDate), L + 130, y, 8);
  text(String(allowance.days), L + 260, y, 8);
  text(formatIDR(allowance.mealAmount), L + 330, y, 8);
  y -= 16;
  line(y); y -= 16;

  // Total bar
  const intercityTotal = sumIDR(intercity);
  const urbanTotal = sumIDR(urban);
  const accommTotal = form.accommodation.reduce((s, a) => s + a.amount, 0);
  const grandTotal = intercityTotal + urbanTotal + accommTotal + allowance.mealAmount;
  cover.drawRectangle({ x: L, y: y - 4, width: R - L, height: 22, color: rgb(0.949, 0.949, 0.980) });
  cover.drawText(safe("TOTAL REIMBURSEMENT"), { x: L + 8, y: y + 5, size: 9, font: fontBold, color: indigo });
  cover.drawText(safe(formatIDR(grandTotal)), { x: R - 100, y: y + 5, size: 10, font: fontBold, color: indigo });
  y -= 26;

  // Approval
  y -= 10;
  text("Approved by:", L, y, 9, true); y -= 20;
  line(y); y -= 8;
  if (form.remarks) text(`Remarks: ${safe(form.remarks)}`, L, y, 8, false, slate);

  // ── PAGE 2: SUMMARY ─────────────────────────────────────────────────────────
  const summary = pdfDoc.addPage(PageSizes.A4);
  const sw = summary.getSize().width;
  const sh = summary.getSize().height;
  let sy = sh - 40;
  const sL = 30;

  const stext = (t: string, x: number, yy: number, size = 8, bold = false, color = rgb(0, 0, 0)) =>
    summary.drawText(safe(String(t)), { x, y: yy, size, font: bold ? fontBold : font, color });
  const sline = (yy: number, color = rgb(0.85, 0.85, 0.85)) =>
    summary.drawLine({ start: { x: sL, y: yy }, end: { x: sw - 30, y: yy }, thickness: 0.5, color });

  // Header bar
  summary.drawRectangle({ x: 0, y: sh - 52, width: sw, height: 52, color: indigo });
  summary.drawText(safe("Domestic Daily Expenses List"), { x: sL, y: sh - 34, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  summary.drawText(safe(`${form.department}  |  ${form.month}`), { x: sL, y: sh - 48, size: 8, font, color: rgb(0.8, 0.85, 1) });
  sy = sh - 70;

  // Table header
  const cols = [sL, sL + 22, sL + 85, sL + 165, sL + 265, sL + 335, sL + 405];
  const colLabels = ["#", "Name", "Date", "Expense Type", "Currency", "Amount", "Notes"];
  summary.drawRectangle({ x: sL, y: sy - 4, width: sw - 60, height: 16, color: rgb(0.949, 0.949, 0.980) });
  colLabels.forEach((lbl, i) => stext(safe(lbl), cols[i], sy + 2, 7, true, indigo));
  sy -= 8; sline(sy); sy -= 4;

  const categoryLabel: Record<string, string> = {
    transportation_intercity: "Transport (Intercity)",
    transportation_urban: "Transport (Urban)",
    accommodation: "Accommodation",
    other: "Other",
  };

  const allReceipts = [...form.receipts].sort((a, b) => a.date.localeCompare(b.date));
  allReceipts.forEach((r, i) => {
    sy -= 13;
    if (i % 2 === 0) summary.drawRectangle({ x: sL, y: sy - 3, width: sw - 60, height: 13, color: rgb(0.98, 0.98, 0.99) });
    stext(String(i + 1), cols[0], sy, 8);
    stext(safe(form.employeeName), cols[1], sy, 8);
    stext(formatDate(r.date), cols[2], sy, 8);
    stext(categoryLabel[r.category] || r.category, cols[3], sy, 8);
    stext(r.currency, cols[4], sy, 8);
    stext(r.amount.toLocaleString("id-ID"), cols[5], sy, 8);
    const note = safe(r.vendor ? `${r.vendor}: ${r.origin || ""} -> ${r.destination || ""}` : r.description);
    stext(note.substring(0, 38), cols[6], sy, 7, false, slate);
  });

  sy -= 18; sline(sy, indigo); sy -= 14;
  stext("TOTAL", cols[3], sy, 9, true, indigo);
  stext(formatIDR(sumIDR(form.receipts)), cols[5], sy, 9, true, indigo);

  sy -= 30;
  stext(`Prepared by: ${safe(form.employeeName)}`, sL, sy, 8);
  stext("Reviewed by: _______________", sL + 200, sy, 8);

  // ── RECEIPT PAGES ────────────────────────────────────────────────────────────
  for (const receiptFile of receiptFiles) {
    try {
      let embeddedImage;
      if (receiptFile.mimeType === "image/jpeg" || receiptFile.mimeType === "image/jpg") {
        embeddedImage = await pdfDoc.embedJpg(receiptFile.data);
      } else if (receiptFile.mimeType === "image/png") {
        embeddedImage = await pdfDoc.embedPng(receiptFile.data);
      } else {
        try {
          const srcDoc = await PDFDocument.load(receiptFile.data);
          const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => pdfDoc.addPage(p));
        } catch { /* skip */ }
        continue;
      }
      const imgPage = pdfDoc.addPage(PageSizes.A4);
      const { width: pw, height: ph } = imgPage.getSize();
      const margin = 30;
      const maxW = pw - margin * 2;
      const maxH = ph - margin * 2 - 24;
      const { width: iw, height: ih } = embeddedImage;
      const scale = Math.min(maxW / iw, maxH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      imgPage.drawImage(embeddedImage, {
        x: (pw - drawW) / 2,
        y: (ph - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      imgPage.drawText(safe(receiptFile.name), { x: margin, y: ph - 18, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    } catch { /* skip */ }
  }

  return await pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const formJson = formData.get("form") as string;
    const form: ReimbursementForm = JSON.parse(formJson);

    const receiptFiles: { name: string; data: Uint8Array; mimeType: string }[] = [];
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith("receipt_") && value instanceof File) {
        const ab = await value.arrayBuffer();
        receiptFiles.push({ name: value.name, data: new Uint8Array(ab), mimeType: value.type });
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
