"use client";

import { TripInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

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
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_auto] gap-2 items-center">
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Depart</p>
            <Input
              type="date"
              value={row.date}
              onChange={(e) => update(i, { date: e.target.value })}
              className="h-8 text-xs border-slate-200"
            />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Arrive <span className="text-slate-300">(if diff)</span></p>
            <Input
              type="date"
              value={row.arriveDate || ""}
              onChange={(e) => update(i, { arriveDate: e.target.value })}
              className="h-8 text-xs border-slate-200"
            />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Route (From → To)</p>
            <div className="flex gap-1">
              <Input
                placeholder="From"
                value={row.origin}
                onChange={(e) => update(i, { origin: e.target.value })}
                className="h-8 text-xs border-slate-200"
              />
              <Input
                placeholder="To"
                value={row.destination}
                onChange={(e) => update(i, { destination: e.target.value })}
                className="h-8 text-xs border-slate-200"
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Vehicle</p>
            <select
              value={row.vehicle}
              onChange={(e) => update(i, { vehicle: e.target.value })}
              className="h-8 w-full text-xs border border-slate-200 rounded px-2 bg-white"
            >
              {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">Ticketing</p>
            <select
              value={row.ticketingMethod}
              onChange={(e) => update(i, { ticketingMethod: e.target.value })}
              className="h-8 w-full text-xs border border-slate-200 rounded px-2 bg-white"
            >
              {TICKETING.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="pt-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400" onClick={() => remove(i)}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm"
        className="text-xs gap-1.5 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
        onClick={add}>
        <Plus size={12} /> Add Route
      </Button>
    </div>
  );
}
