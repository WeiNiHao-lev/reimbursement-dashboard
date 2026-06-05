import { NextResponse } from "next/server";
import { ReimbursementForm } from "@/lib/types";
import { groupExpenses, sumIDR, computeAllowance, formatIDR, formatDate } from "@/lib/pdf-generator";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";

async function buildPDF(form: ReimbursementForm, receiptFiles: { name: string; data: Uint8Array; mimeType: string }[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { intercity, urban, accommodation } = groupExpenses(form.receipts);
  const allowance = computeAllowance(form);

  const safe = (s: string) =>
    s.replace(/—/g, "-").replace(/–/g, "-").replace(/→/g, "->").replace(/×/g, "x")
     .replace(/[^\x20-\x7E]/g, "").trim();

  const cover = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = cover.getSize();
  let y = height - 40;
  const L = 40, R = width - 40, col2 = width / 2;
  const indigo = rgb(0.306, 0.275, 0.898);
  const slate = rgb(0.44, 0.5, 0.56);

  const line = (y2: number, color = rgb(0.8, 0.8, 0.8)) =>
    cover.drawLine({ start: { x: L, y: y2 }, end: { x: R, y: y2 }, thickness: 0.5, color });
  const text = (t: string, x: number, yy: number, size = 9, bold = false, color = rgb(0, 0, 0)) =>
    cover.drawText(safe(t), { x, y: yy, size, font: bold ? fontBold : font, color });

  cover.drawRectangle({ x: 0, y: height - 52, width, height: 52, color: indigo });
  cover.drawText(safe(form.tripType === "domestic" ? "Business Trip Reimbursement Form - Domestic" : "Business Trip Reimbursement Form - Overseas"),
    { x: L, y: height - 34, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  cover.drawText(safe("CCEPC Marketing Department"), { x: L, y: height - 48, size: 8, font, color: rgb(0.8, 0.85, 1) });
  y = height - 70;

  text("BASIC INFORMATION", L, y, 7, true, slate); y -= 14;
  text(`Name: ${form.employeeName}`, L, y); text(`Department: ${form.department}`, col2, y); y -= 13;
  text(`Permanent Residence: ${form.permanentResidence}`, L, y); text(`Period: ${form.month}`, col2, y); y -= 13;
  text(`Purpose: ${form.purpose}`, L, y); y -= 8; line(y); y -= 16;

  text("TRIP ROUTES", L, y, 7, true, slate); y -= 14;
  text("Date", L, y, 8, true, slate); text("Route", L + 90, y, 8, true, slate);
  text("Vehicle", L + 270, y, 8, true, slate); text("Ticketing", L + 340, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  for (const t of form.tripInfo.slice(0, 4)) {
    text(formatDate(t.date), L, y, 8); text(safe(`${t.origin} -> ${t.destination}`), L + 90, y, 8);
    text(t.vehicle, L + 270, y, 8); text(t.ticketingMethod, L + 340, y, 8); y -= 12;
  }
  if (!form.tripInfo.length) { text("-", L, y, 8, false, slate); y -= 12; }
  line(y); y -= 16;

  text("TRANSPORTATION EXPENSES", L, y, 7, true, slate); y -= 14;
  text("Route / City", L, y, 8, true, slate); text("Inter-city (IDR)", L + 180, y, 8, true, slate);
  text("Urban (IDR)", L + 300, y, 8, true, slate); text("Total (IDR)", L + 400, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;

  const urbanByCity: Record<string, number> = {};
  for (const r of urban) { const c = safe((r.destination || r.origin || "Unknown").split(",")[0]); urbanByCity[c] = (urbanByCity[c] || 0) + (r.currency === "IDR" ? r.amount : 0); }
  const intercityByRoute: Record<string, number> = {};
  for (const r of intercity) { const k = safe(`${r.origin || ""} - ${r.destination || ""}`); intercityByRoute[k] = (intercityByRoute[k] || 0) + (r.currency === "IDR" ? r.amount : 0); }
  const allRoutes = new Set([...Object.keys(urbanByCity), ...Object.keys(intercityByRoute)]);
  for (const route of Array.from(allRoutes).slice(0, 6)) {
    const inter = intercityByRoute[route] || 0, urb = urbanByCity[route] || 0;
    text(route || "-", L, y, 8); text(inter > 0 ? formatIDR(inter) : "-", L + 180, y, 8);
    text(urb > 0 ? formatIDR(urb) : "-", L + 300, y, 8); text(formatIDR(inter + urb), L + 400, y, 8); y -= 12;
  }
  if (!allRoutes.size) { text("-", L, y, 8, false, slate); y -= 12; }
  line(y); y -= 16;

  text("ACCOMMODATION EXPENSES", L, y, 7, true, slate); y -= 14;
  text("Location", L, y, 8, true, slate); text("Nights", L + 200, y, 8, true, slate); text("Amount (IDR)", L + 280, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  for (const a of form.accommodation.slice(0, 4)) { text(safe(a.location), L, y, 8); text(String(a.days), L + 200, y, 8); text(formatIDR(a.amount), L + 280, y, 8); y -= 12; }
  if (accommodation.length && !form.accommodation.length) { for (const a of accommodation.slice(0, 4)) { text(safe(a.destination || a.origin || "-"), L, y, 8); text("-", L + 200, y, 8); text(formatIDR(a.amount), L + 280, y, 8); y -= 12; } }
  if (!form.accommodation.length && !accommodation.length) { text("-", L, y, 8, false, slate); y -= 12; }
  line(y); y -= 16;

  text("ALLOWANCE INFORMATION", L, y, 7, true, slate); y -= 14;
  text("Meal Allowance  IDR 200,000/day", L, y, 8, true); y -= 12;
  text("Start Date", L, y, 8, true, slate); text("End Date", L + 130, y, 8, true, slate);
  text("Days", L + 260, y, 8, true, slate); text("Total Amount", L + 330, y, 8, true, slate);
  y -= 4; line(y, rgb(0.9, 0.9, 0.9)); y -= 10;
  text(formatDate(allowance.startDate), L, y, 8); text(formatDate(allowance.endDate), L + 130, y, 8);
  text(String(allowance.days), L + 260, y, 8); text(formatIDR(allowance.mealAmount), L + 330, y, 8); y -= 16;
  line(y); y -= 16;

  const grandTotal = sumIDR(intercity) + sumIDR(urban) + form.accommodation.reduce((s, a) => s + a.amount, 0) + allowance.mealAmount;
  cover.drawRectangle({ x: L, y: y - 4, width: R - L, height: 22, color: rgb(0.949, 0.949, 0.980) });
  cover.drawText(safe("TOTAL REIMBURSEMENT"), { x: L + 8, y: y + 5, size: 9, font: fontBold, color: indigo });
  cover.drawText(safe(formatIDR(grandTotal)), { x: R - 100, y: y + 5, size: 10, font: fontBold, color: indigo });
  y -= 26; y -= 10;
  text("Approved by:", L, y, 9, true); y -= 20; line(y);
  if (form.remarks) { y -= 8; text(`Remarks: ${safe(form.remarks)}`, L, y, 8, false, slate); }

  // Page 2: Summary
  const summary = pdfDoc.addPage(PageSizes.A4);
  const sw = summary.getSize().width, sh = summary.getSize().height;
  let sy = sh - 40;
  const sL = 30;
  const stext = (t: string, x: number, yy: number, size = 8, bold = false, color = rgb(0, 0, 0)) =>
    summary.drawText(safe(String(t)), { x, y: yy, size, font: bold ? fontBold : font, color });
  const sline = (yy: number, color = rgb(0.85, 0.85, 0.85)) =>
    summary.drawLine({ start: { x: sL, y: yy }, end: { x: sw - 30, y: yy }, thickness: 0.5, color });

  summary.drawRectangle({ x: 0, y: sh - 52, width: sw, height: 52, color: indigo });
  summary.drawText(safe("Domestic Daily Expenses List"), { x: sL, y: sh - 34, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  summary.drawText(safe(`${form.department}  |  ${form.month}`), { x: sL, y: sh - 48, size: 8, font, color: rgb(0.8, 0.85, 1) });
  sy = sh - 70;

  const cols = [sL, sL + 22, sL + 85, sL + 165, sL + 265, sL + 335, sL + 405];
  summary.drawRectangle({ x: sL, y: sy - 4, width: sw - 60, height: 16, color: rgb(0.949, 0.949, 0.980) });
  ["#", "Name", "Date", "Expense Type", "Currency", "Amount", "Notes"].forEach((lbl, i) =>
    stext(lbl, cols[i], sy + 2, 7, true, indigo));
  sy -= 8; sline(sy); sy -= 4;

  const catLabel: Record<string, string> = { transportation_intercity: "Transport (Intercity)", transportation_urban: "Transport (Urban)", accommodation: "Accommodation", other: "Other" };
  const sortedReceipts = [...form.receipts].sort((a, b) => a.date.localeCompare(b.date));
  sortedReceipts.forEach((r, i) => {
    sy -= 13;
    if (i % 2 === 0) summary.drawRectangle({ x: sL, y: sy - 3, width: sw - 60, height: 13, color: rgb(0.98, 0.98, 0.99) });
    stext(String(i + 1), cols[0], sy, 8); stext(safe(form.employeeName), cols[1], sy, 8);
    stext(formatDate(r.date), cols[2], sy, 8); stext(catLabel[r.category] || r.category, cols[3], sy, 8);
    stext(r.currency, cols[4], sy, 8); stext(r.amount.toLocaleString("id-ID"), cols[5], sy, 8);
    const note = safe(r.vendor ? `${r.vendor}: ${r.origin || ""} -> ${r.destination || ""}` : r.description);
    stext(note.substring(0, 38), cols[6], sy, 7, false, slate);
  });

  sy -= 18; sline(sy, indigo); sy -= 14;
  stext("TOTAL", cols[3], sy, 9, true, indigo); stext(formatIDR(sumIDR(form.receipts)), cols[5], sy, 9, true, indigo);
  sy -= 30; stext(`Prepared by: ${safe(form.employeeName)}`, sL, sy, 8); stext("Reviewed by: _______________", sL + 200, sy, 8);

  // Receipt pages
  for (const rf of receiptFiles) {
    try {
      let img;
      if (rf.mimeType === "image/jpeg" || rf.mimeType === "image/jpg") img = await pdfDoc.embedJpg(rf.data);
      else if (rf.mimeType === "image/png") img = await pdfDoc.embedPng(rf.data);
      else { try { const src = await PDFDocument.load(rf.data); (await pdfDoc.copyPages(src, src.getPageIndices())).forEach(p => pdfDoc.addPage(p)); } catch {} continue; }
      const p = pdfDoc.addPage(PageSizes.A4); const { width: pw, height: ph } = p.getSize();
      const m = 30, { width: iw, height: ih } = img;
      const sc = Math.min((pw - m * 2) / iw, (ph - m * 2 - 24) / ih);
      p.drawImage(img, { x: (pw - iw * sc) / 2, y: (ph - ih * sc) / 2, width: iw * sc, height: ih * sc });
      p.drawText(safe(rf.name), { x: m, y: ph - 18, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    } catch {}
  }

  return await pdfDoc.save();
}

export async function buildPDFFallback(formData: FormData): Promise<Response> {
  const formJson = formData.get("form") as string;
  const form = JSON.parse(formJson);
  const receiptFiles: { name: string; data: Uint8Array; mimeType: string }[] = [];
  for (const [key, value] of Array.from(formData.entries())) {
    if (key.startsWith("receipt_") && value instanceof File) {
      receiptFiles.push({ name: value.name, data: new Uint8Array(await value.arrayBuffer()), mimeType: value.type });
    }
  }
  const pdfBytes = await buildPDF(form, receiptFiles);
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Reimbursement ${form.month}.pdf"`,
    },
  });
}
