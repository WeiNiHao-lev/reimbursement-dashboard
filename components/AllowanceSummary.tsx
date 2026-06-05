"use client";

import { differenceInDays, parseISO, format } from "date-fns";
import { ExtractedReceipt, TripInfo } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { CalendarDays } from "lucide-react";

interface Props {
  receipts: { data: ExtractedReceipt }[];
  tripInfo: TripInfo[];
  mealAllowanceDaily: number;
  transportAllowanceDaily: number;
  tripType: "domestic" | "overseas";
  startDateOverride: string;
  endDateOverride: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
}

export default function AllowanceSummary({
  receipts,
  tripInfo,
  mealAllowanceDaily,
  transportAllowanceDaily,
  tripType,
  startDateOverride,
  endDateOverride,
  onStartDateChange,
  onEndDateChange,
}: Props) {
  // Auto-detect from receipts/routes, use as placeholder if no override
  const allDates = [
    ...receipts.map((r) => r.data.date),
    ...tripInfo.map((t) => t.date),
  ].filter(Boolean).sort();

  const autoStart = allDates[0] || new Date().toISOString().split("T")[0];
  const autoEnd = allDates[allDates.length - 1] || autoStart;

  const startDate = startDateOverride || autoStart;
  const endDate = endDateOverride || autoEnd;

  let days = 1;
  try {
    days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    if (days < 1) days = 1;
  } catch { days = 1; }

  const mealTotal = days * mealAllowanceDaily;
  const transportTotal = days * transportAllowanceDaily;
  const fmt = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <CalendarDays size={14} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Allowance</span>
        <span className="ml-auto text-xs text-slate-400">auto-filled from routes</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Date range inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Departure Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-9 text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Return Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-9 text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Days badge */}
        <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2.5">
          <span className="text-xs text-indigo-600 font-medium">Total Days</span>
          <span className="text-lg font-bold text-indigo-700">
            {days} <span className="text-sm font-normal">day{days !== 1 ? "s" : ""}</span>
          </span>
        </div>

        {/* Allowance breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-600">Meal Allowance</span>
              <span className="ml-2 text-xs text-slate-400">
                {days} × {new Intl.NumberFormat("id-ID").format(mealAllowanceDaily)}
              </span>
            </div>
            <span className="font-semibold text-slate-700">{fmt(mealTotal)}</span>
          </div>
          {tripType === "overseas" && (
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-slate-600">Transport Allowance</span>
                <span className="ml-2 text-xs text-slate-400">
                  {days} × {new Intl.NumberFormat("id-ID").format(transportAllowanceDaily)}
                </span>
              </div>
              <span className="font-semibold text-slate-700">{fmt(transportTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
