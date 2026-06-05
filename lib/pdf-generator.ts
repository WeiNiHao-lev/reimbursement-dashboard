import { ReimbursementForm, ExtractedReceipt } from "./types";
import { format, parseISO, differenceInDays } from "date-fns";

// Returns base64 PDF data URL using jsPDF on the server via API route
// The actual PDF is built in the API route using a headless approach

export function groupExpenses(receipts: ExtractedReceipt[]) {
  const intercity = receipts.filter((r) => r.category === "transportation_intercity");
  const urban = receipts.filter((r) => r.category === "transportation_urban");
  const accommodation = receipts.filter((r) => r.category === "accommodation");
  const other = receipts.filter((r) => r.category === "other");
  return { intercity, urban, accommodation, other };
}

export function sumIDR(receipts: ExtractedReceipt[]): number {
  return receipts.filter((r) => r.currency === "IDR").reduce((s, r) => s + r.amount, 0);
}

export function computeAllowance(form: ReimbursementForm): {
  startDate: string;
  endDate: string;
  days: number;
  mealAmount: number;
  transportAmount: number;
} {
  const allDates = form.receipts
    .map((r) => r.date)
    .concat(form.tripInfo.map((t) => t.date))
    .filter(Boolean)
    .sort();

  const autoStart = allDates[0] || new Date().toISOString().split("T")[0];
  const autoEnd = allDates[allDates.length - 1] || autoStart;

  // Use frontend override if provided, otherwise fall back to auto-detected dates
  const startDate = form.allowanceStartDate || autoStart;
  const endDate = form.allowanceEndDate || autoEnd;
  let days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  if (days < 1) days = 1;

  return {
    startDate,
    endDate,
    days,
    mealAmount: days * form.mealAllowanceDailyIDR,
    transportAmount: days * form.transportAllowanceDailyIDR,
  };
}

export function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd-MMM-yyyy");
  } catch {
    return iso;
  }
}
