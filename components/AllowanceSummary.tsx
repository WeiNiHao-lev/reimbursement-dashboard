"use client";

import { differenceInDays, parseISO, format } from "date-fns";
import { ExtractedReceipt, TripInfo } from "@/lib/types";
import { Input } from "@/components/ui/input";

interface Props {
  receipts: { data: ExtractedReceipt }[];
  tripInfo: TripInfo[];
  mealAllowanceDaily: number;
  transportAllowanceDaily: number;
  tripType: "domestic" | "overseas";
  onMealChange: (v: number) => void;
  onTransportChange: (v: number) => void;
}

export default function AllowanceSummary({
  receipts,
  tripInfo,
  mealAllowanceDaily,
  transportAllowanceDaily,
  tripType,
  onMealChange,
  onTransportChange,
}: Props) {
  const allDates = [
    ...receipts.map((r) => r.data.date),
    ...tripInfo.map((t) => t.date),
  ]
    .filter(Boolean)
    .sort();

  const startDate = allDates[0] || new Date().toISOString().split("T")[0];
  const endDate = allDates[allDates.length - 1] || startDate;
  const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  const mealTotal = days * mealAllowanceDaily;
  const transportTotal = days * transportAllowanceDaily;

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const fmtDate = (d: string) => { try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; } };

  return (
    <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-amber-800">🗓 Allowance Information</span>
        <span className="text-xs text-amber-600">(auto-calculated from receipt dates)</span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">Start Date</p>
          <p className="font-medium">{fmtDate(startDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">End Date</p>
          <p className="font-medium">{fmtDate(endDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Days</p>
          <p className="font-bold text-amber-700 text-lg">{days} day{days !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded p-3 border">
          <p className="text-xs text-gray-500 mb-1">Meal Allowance / day (IDR)</p>
          <Input
            type="number"
            value={mealAllowanceDaily}
            onChange={(e) => onMealChange(Number(e.target.value))}
            className="h-8 text-sm"
          />
          <p className="text-xs text-green-700 font-semibold mt-1">
            {days} × {fmt(mealAllowanceDaily)} = <span className="text-base">{fmt(mealTotal)}</span>
          </p>
        </div>
        {tripType === "overseas" && (
          <div className="bg-white rounded p-3 border">
            <p className="text-xs text-gray-500 mb-1">Transport Allowance / day (IDR)</p>
            <Input
              type="number"
              value={transportAllowanceDaily}
              onChange={(e) => onTransportChange(Number(e.target.value))}
              className="h-8 text-sm"
            />
            <p className="text-xs text-blue-700 font-semibold mt-1">
              {days} × {fmt(transportAllowanceDaily)} = <span className="text-base">{fmt(transportTotal)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
