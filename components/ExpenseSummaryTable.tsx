"use client";

import { ExtractedReceipt, ExpenseCategory } from "@/lib/types";

const LABELS: Record<ExpenseCategory, string> = {
  transportation_intercity: "Transport Inter-city",
  transportation_urban: "Transport Urban",
  accommodation: "Accommodation",
  other: "Other",
};

const COLORS: Record<ExpenseCategory, string> = {
  transportation_intercity: "text-blue-700 bg-blue-50",
  transportation_urban: "text-green-700 bg-green-50",
  accommodation: "text-purple-700 bg-purple-50",
  other: "text-gray-700 bg-gray-50",
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

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Category</th>
            <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Amount (IDR)</th>
          </tr>
        </thead>
        <tbody>
          {(Object.entries(grouped) as [ExpenseCategory, number][]).map(([cat, amt]) => (
            <tr key={cat} className="border-b last:border-0">
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLORS[cat]}`}>
                  {LABELS[cat]}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm">
                {amt > 0 ? fmt(amt) : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
          <tr className="border-b bg-amber-50">
            <td className="px-3 py-2 text-xs text-amber-700 font-medium">Meal Allowance</td>
            <td className="px-3 py-2 text-right font-mono text-sm text-amber-700">{fmt(mealAllowance)}</td>
          </tr>
          {tripType === "overseas" && (
            <tr className="border-b bg-amber-50">
              <td className="px-3 py-2 text-xs text-amber-700 font-medium">Transport Allowance</td>
              <td className="px-3 py-2 text-right font-mono text-sm text-amber-700">{fmt(transportAllowance)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900 text-white">
            <td className="px-3 py-2.5 font-bold text-sm">TOTAL REIMBURSEMENT</td>
            <td className="px-3 py-2.5 text-right font-bold font-mono text-sm">{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
