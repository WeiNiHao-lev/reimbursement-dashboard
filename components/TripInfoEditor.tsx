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
      { date: new Date().toISOString().split("T")[0], origin: "", destination: "", vehicle: "Airplane", ticketingMethod: "Online" },
    ]);

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const update = (i: number, patch: Partial<TripInfo>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 items-center">
          <Input
            type="date"
            value={row.date}
            onChange={(e) => update(i, { date: e.target.value })}
            className="h-8 text-xs"
          />
          <div className="flex gap-1">
            <Input
              placeholder="From"
              value={row.origin}
              onChange={(e) => update(i, { origin: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              placeholder="To"
              value={row.destination}
              onChange={(e) => update(i, { destination: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <select
            value={row.vehicle}
            onChange={(e) => update(i, { vehicle: e.target.value })}
            className="h-8 text-xs border rounded px-2 bg-white"
          >
            {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select
            value={row.ticketingMethod}
            onChange={(e) => update(i, { ticketingMethod: e.target.value })}
            className="h-8 text-xs border rounded px-2 bg-white"
          >
            {TICKETING.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(i)}>
            <Trash2 size={14} className="text-red-400" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs gap-1">
        <Plus size={12} /> Add Route
      </Button>
    </div>
  );
}
