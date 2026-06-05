"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { ExtractedReceipt, ExpenseCategory, Currency } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ReceiptItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "extracting" | "done" | "error";
  data: Partial<ExtractedReceipt>;
  error?: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transportation_intercity: "🚂 Transport (Inter-city)",
  transportation_urban: "🚕 Transport (Urban)",
  accommodation: "🏨 Accommodation",
  other: "📎 Other",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  transportation_intercity: "bg-blue-100 text-blue-800",
  transportation_urban: "bg-green-100 text-green-800",
  accommodation: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-800",
};

interface Props {
  onChange: (receipts: { file: File; data: ExtractedReceipt }[]) => void;
}

export default function ReceiptDropzone({ onChange }: Props) {
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const notify = (newItems: ReceiptItem[]) => {
    const done = newItems.filter((i) => i.status === "done" && i.data.date);
    onChange(done.map((i) => ({ file: i.file, data: i.data as ExtractedReceipt })));
  };

  const extractFile = async (item: ReceiptItem): Promise<ReceiptItem> => {
    const formData = new FormData();
    formData.append("file", item.file);
    const blank = {
      fileName: item.file.name,
      date: new Date().toISOString().split("T")[0],
      description: "",
      amount: 0,
      currency: "IDR" as const,
      category: "other" as const,
      origin: "",
      destination: "",
    };
    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const json = await res.json();
      // Manual mode — no API key, show empty form
      if (json.manual) {
        return { ...item, status: "done", data: { ...item.data, id: item.id, ...blank }, error: undefined };
      }
      if (!res.ok || json.error) {
        return { ...item, status: "done", data: { ...item.data, id: item.id, ...blank }, error: json.error };
      }
      return { ...item, status: "done", data: { ...item.data, id: item.id, fileUrl: item.previewUrl, ...json } };
    } catch {
      return { ...item, status: "error", error: "Network error" };
    }
  };

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const newItems: ReceiptItem[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "extracting" as const,
        data: { fileName: file.name, currency: "IDR", category: "other" },
      }));
      setItems((prev) => {
        const merged = [...prev, ...newItems];
        notify(merged);
        return merged;
      });

      const extracted = await Promise.all(newItems.map(extractFile));
      setItems((prev) => {
        const map = Object.fromEntries(extracted.map((e) => [e.id, e]));
        const merged = prev.map((i) => map[i.id] || i);
        notify(merged);
        return merged;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      notify(next);
      return next;
    });
  };

  const update = (id: string, patch: Partial<ExtractedReceipt>) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, data: { ...i.data, ...patch } } : i));
      notify(next);
      return next;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [] },
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? "Drop receipts here..." : "Drop receipts here, or click to browse"}
        </p>
        <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, WebP, PDF</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 bg-white shadow-sm">
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                  {item.file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">PDF</div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {item.status === "extracting" && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    {item.status === "done" && !item.error && <CheckCircle size={14} className="text-green-500" />}
                    {(item.status === "error" || item.error) && <AlertCircle size={14} className="text-amber-500" />}
                    <span className="text-xs font-medium text-gray-600 truncate">{item.file.name}</span>
                  </div>

                  {item.status === "extracting" ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Date</label>
                        <Input
                          type="date"
                          value={item.data.date || ""}
                          onChange={(e) => update(item.id, { date: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Amount (IDR)</label>
                        <Input
                          type="number"
                          value={item.data.amount || ""}
                          onChange={(e) => update(item.id, { amount: Number(e.target.value) })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Category</label>
                        <Select
                          value={item.data.category || "other"}
                          onValueChange={(v) => update(item.id, { category: v as ExpenseCategory })}
                        >
                          <SelectTrigger className="h-7 text-xs mt-0.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">From</label>
                        <Input
                          value={item.data.origin || ""}
                          onChange={(e) => update(item.id, { origin: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                          placeholder="Origin"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">To</label>
                        <Input
                          value={item.data.destination || ""}
                          onChange={(e) => update(item.id, { destination: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                          placeholder="Destination"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Description</label>
                        <Input
                          value={item.data.description || ""}
                          onChange={(e) => update(item.id, { description: e.target.value })}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                    </div>
                  )}
                  {item.error && item.status !== "error" && (
                    <p className="text-xs text-amber-600 mt-1">⚠ {item.error} — please fill in manually.</p>
                  )}
                </div>

                <div className="flex items-start gap-1">
                  <Badge className={`text-xs px-1.5 py-0.5 ${CATEGORY_COLORS[item.data.category as ExpenseCategory] || ""}`}>
                    {CATEGORY_LABELS[item.data.category as ExpenseCategory] || item.data.category}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(item.id)}>
                    <X size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
