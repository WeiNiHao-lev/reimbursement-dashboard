export type TripType = "domestic" | "overseas";
export type ExpenseCategory = "transportation_intercity" | "transportation_urban" | "accommodation" | "other";
export type Currency = "IDR" | "CNY" | "USD" | "SGD" | "MYR" | "EUR";

export interface ExtractedReceipt {
  id: string;
  fileName: string;
  fileUrl: string;
  date: string; // ISO date
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  origin?: string;
  destination?: string;
  vendor?: string;
  rawText?: string;
}

export interface TripInfo {
  date: string;
  origin: string;
  destination: string;
  vehicle: string;
  ticketingMethod: string;
}

export interface AccommodationRow {
  location: string;
  days: number;
  amount: number;
  currency?: Currency;
}

export interface AllowanceRow {
  startDate: string;
  endDate: string;
  days: number;
  amountPerDay: number;
}

export interface ReimbursementForm {
  id?: string;
  tripType: TripType;
  employeeName: string;
  department: string;
  permanentResidence: string;
  purpose: string;
  month: string; // e.g. "Mei 2026"
  tripInfo: TripInfo[];
  receipts: ExtractedReceipt[];
  accommodation: AccommodationRow[];
  mealAllowanceDailyIDR: number;
  transportAllowanceDailyIDR: number; // overseas only
  mealAllowanceDailyCNY: number; // overseas only
  exchangeRate1: number;
  exchangeRate2: number;
  remarks: string;
}
