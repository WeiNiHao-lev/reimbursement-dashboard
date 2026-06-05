"use client";

import { ExtractedReceipt, ExpenseCategory } from "@/lib/types";
import { Receipt } from "lucide-react";

const LABELS: Record<ExpenseCategory, string> = {
  transportation_intercity: "Transport — Inter-city",
  transportation_urban: "Transport — Urban",
  accommodation: "Accommodation",
  other: "Other",
};

interface Props {
  receipts: { data: ExtractedReceipt }[];
  mealAllowance: number;
  transportAllowance: number;
  tripType: "domestic" | "overseas";
}

export default function ExpenseSummaryTable({ receipts, mealAllowance, transportAllowance, tripType }: Props) {
  const fmt = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

  const grouped = receipts.reduce<Record<ExpenseCategory, number>>(
    (acc, r) => {
      if (r.data.currency === "IDR") acc[r.data.category] = (acc[r.data.category] || 0) + r.data.amount;
      return acc;
    },
    { transportation_intercity: 0, transportation_urban: 0, accommodation: 0, other: 0 }
  );

  const expenseTotal = Object.values(grouped).reduce((s, v) => s + v, 0);
  const allowanceTotal = mealAllowance + (tripType === "overseas" ? transportAllowance : 0);
  const grandTotal = expenseTotal + allowanceTotal;

  const rows: { label: string; amount: number; isAllowance?: boolean }[] = [
    { label: LABELS.transportation_intercity, amount: grouped.transportation_intercity },
    { label: LABELS.transportation_urban, amount: grouped.transportation_urban },
    { label: LABELS.accommodation, amount: grouped.accommodation },
    { label: LABELS.other, amount: grouped.other },
    { label: "Meal Allowance", amount: mealAllowance, isAllowance: true },
    ...(tripType === "overseas" ? [{ label: "Transport Allowance", amount: transportAllowance, isAllowance: true }] : []),
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <Receipt size={14} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Summary</span>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map(({ label, amount, isAllowance }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className={`text-xs ${isAllowance ? "text-indigo-600 font-medium" : "text-slate-500"}`}>
              {label}
            </span>
            <span className={`text-sm font-mono ${amount > 0 ? (isAllowance ? "text-indigo-700 font-semibold" : "text-slate-700 font-medium") : "text-slate-300"}`}>
              {amount > 0 ? fmt(amount) : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
        <span className="text-xs font-bold text-indigo-100 uppercase tracking-wide">Total Reimbursement</span>
        <span className="text-sm font-bold font-mono text-white">{fmt(grandTotal)}</span>
      </div>
    </div>
  );
}
