"use client";

import { TripInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface Props {
  rows: TripInfo[];
  onChange: (rows: TripInfo[]) => void;
}

const VEHICLES = ["Airplane", "Train", "Bus", "Car", "Ship", "Taxi"];
const TICKETING = ["Online", "Travel Agent", "Office", "Self-booked"];

export default function TripInfoEditor({ rows, onChange }: Props) {
  const add = () =>
    onChange([
      ...rows,
      { date: "", arriveDate: "", origin: "", destination: "", vehicle: "Airplane", ticketingMethod: "Online" },
    ]);

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<TripInfo>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          {/* Row 1: Dates */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Departure Date</label>
              <Input
                type="date"
                value={row.date}
                onChange={(e) => update(i, { date: e.target.value })}
                className="h-9 text-sm bg-white border-slate-200"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">
                Arrival Date <span className="text-slate-300 font-normal">(if different)</span>
              </label>
              <Input
                type="date"
                value={row.arriveDate || ""}
                onChange={(e) => update(i, { arriveDate: e.target.value })}
                className="h-9 text-sm bg-white border-slate-200"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Vehicle</label>
              <select
                value={row.vehicle}
                onChange={(e) => update(i, { vehicle: e.target.value })}
                className="h-9 w-full text-sm border border-slate-200 rounded-md px-3 bg-white text-slate-700"
              >
                {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Ticketing</label>
              <select
                value={row.ticketingMethod}
                onChange={(e) => update(i, { ticketingMethod: e.target.value })}
                className="h-9 w-full text-sm border border-slate-200 rounded-md px-3 bg-white text-slate-700"
              >
                {TICKETING.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pt-5">
              <Button
                variant="ghost" size="icon"
                className="h-9 w-9 text-slate-300 hover:text-red-400 hover:bg-red-50"
                onClick={() => remove(i)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>

          {/* Row 2: Route */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">From</label>
              <Input
                placeholder="e.g. Jakarta"
                value={row.origin}
                onChange={(e) => update(i, { origin: e.target.value })}
                className="h-9 text-sm bg-white border-slate-200"
              />
            </div>
            <div className="pt-4 text-slate-300">
              <ArrowRight size={16} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-1">To</label>
              <Input
                placeholder="e.g. Surabaya"
                value={row.destination}
                onChange={(e) => update(i, { destination: e.target.value })}
                className="h-9 text-sm bg-white border-slate-200"
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        variant="outline" size="sm"
        className="text-xs gap-1.5 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
        onClick={add}
      >
        <Plus size={12} /> Add Route
      </Button>
    </div>
  );
}
