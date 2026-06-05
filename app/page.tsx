"use client";

import { useState } from "react";
import { FileText, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import ReceiptDropzone from "@/components/ReceiptDropzone";
import TripInfoEditor from "@/components/TripInfoEditor";
import AllowanceSummary from "@/components/AllowanceSummary";
import ExpenseSummaryTable from "@/components/ExpenseSummaryTable";
import { ExtractedReceipt, TripInfo, ReimbursementForm, AccommodationRow } from "@/lib/types";
import { differenceInDays, parseISO } from "date-fns";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">{children}</p>
  );
}

export default function Home() {
  const [tripType, setTripType] = useState<"domestic" | "overseas">("domestic");
  const [employeeName, setEmployeeName] = useState("Daffa Khairi");
  const [department, setDepartment] = useState("Marketing Department");
  const [residence, setResidence] = useState("Jakarta");
  const [purpose, setPurpose] = useState("");
  const [month, setMonth] = useState(() =>
    new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  );
  const [tripInfo, setTripInfo] = useState<TripInfo[]>([]);
  const [receipts, setReceipts] = useState<{ file: File; data: ExtractedReceipt }[]>([]);
  const [accommodation, setAccommodation] = useState<AccommodationRow[]>([]);
  const [startDateOverride, setStartDateOverride] = useState("");
  const [endDateOverride, setEndDateOverride] = useState("");
  const [remarks, setRemarks] = useState("");
  const [generating, setGenerating] = useState(false);

  const MEAL_DAILY = 200000;
  const TRANSPORT_DAILY = 200000;

  const computeAllowanceTotals = () => {
    const allDates = [
      ...receipts.map((r) => r.data.date),
      ...tripInfo.map((t) => t.date),
    ].filter(Boolean).sort();
    const autoStart = allDates[0] || new Date().toISOString().split("T")[0];
    const autoEnd = allDates[allDates.length - 1] || autoStart;
    const start = startDateOverride || autoStart;
    const end = endDateOverride || autoEnd;
    let days = differenceInDays(parseISO(end), parseISO(start)) + 1;
    if (days < 1) days = 1;
    return { days, mealTotal: days * MEAL_DAILY, transportTotal: days * TRANSPORT_DAILY };
  };

  const { mealTotal, transportTotal } = computeAllowanceTotals();

  const generatePDF = async () => {
    if (receipts.length === 0) {
      toast.error("Please upload at least one receipt.");
      return;
    }
    setGenerating(true);
    try {
      const form: ReimbursementForm = {
        tripType, employeeName, department,
        permanentResidence: residence, purpose, month,
        tripInfo, receipts: receipts.map((r) => r.data),
        accommodation,
        mealAllowanceDailyIDR: MEAL_DAILY,
        transportAllowanceDailyIDR: TRANSPORT_DAILY,
        mealAllowanceDailyCNY: 100,
        exchangeRate1: 2300, exchangeRate2: 2300, remarks,
      };
      const fd = new FormData();
      fd.append("form", JSON.stringify(form));
      receipts.forEach((r, i) => fd.append(`receipt_${i}`, r.file));

      const res = await fetch("/api/generate-pdf", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "PDF generation failed"); }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Reimbursement ${month}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-indigo-600 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FileText className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Reimbursement Dashboard</h1>
              <p className="text-xs text-indigo-200">CCEPC Marketing Department</p>
            </div>
          </div>
          <Button
            onClick={generatePDF}
            disabled={generating}
            className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow-sm"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {generating ? "Generating…" : "Generate PDF"}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Trip type */}
        <Tabs value={tripType} onValueChange={(v) => setTripType(v as "domestic" | "overseas")}>
          <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-lg h-auto">
            <TabsTrigger value="domestic" className="text-xs px-4 py-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-md">
              Domestic (境内)
            </TabsTrigger>
            <TabsTrigger value="overseas" className="text-xs px-4 py-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-md">
              Overseas (境外)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="domestic" className="mt-0" />
          <TabsContent value="overseas" className="mt-0" />
        </Tabs>

        <div className="grid grid-cols-3 gap-5">
          {/* ── Left column ── */}
          <div className="col-span-2 space-y-4">

            {/* Basic Info */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Employee Name</Label>
                  <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}
                    className="h-8 text-sm mt-1 border-slate-200 focus:border-indigo-400" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Department</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)}
                    className="h-8 text-sm mt-1 border-slate-200 focus:border-indigo-400" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Permanent Residence</Label>
                  <Input value={residence} onChange={(e) => setResidence(e.target.value)}
                    className="h-8 text-sm mt-1 border-slate-200 focus:border-indigo-400" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Month / Period</Label>
                  <Input value={month} onChange={(e) => setMonth(e.target.value)}
                    className="h-8 text-sm mt-1 border-slate-200 focus:border-indigo-400" placeholder="e.g. Mei 2026" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500">Purpose of Business Trip</Label>
                  <Input value={purpose} onChange={(e) => setPurpose(e.target.value)}
                    className="h-8 text-sm mt-1 border-slate-200 focus:border-indigo-400"
                    placeholder="e.g. Business trip to Surabaya for project coordination" />
                </div>
              </CardContent>
            </Card>

            {/* Trip Routes */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Trip Routes</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 mb-2">
                  {["Date", "Route (From → To)", "Vehicle", "Ticketing", ""].map((h) => (
                    <p key={h} className="text-[11px] text-slate-400 font-medium">{h}</p>
                  ))}
                </div>
                <TripInfoEditor rows={tripInfo} onChange={setTripInfo} />
              </CardContent>
            </Card>

            {/* Receipts */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Upload Receipts
                  <span className="normal-case font-normal text-slate-400">— AI extracts data automatically</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <ReceiptDropzone onChange={setReceipts} />
              </CardContent>
            </Card>

            {/* Accommodation */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Accommodation</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {accommodation.length === 0 && (
                  <p className="text-xs text-slate-400 py-1">No accommodation added.</p>
                )}
                {accommodation.map((a, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_2fr_auto] gap-2 items-center">
                    <Input placeholder="Location / City" value={a.location}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                      className="h-8 text-xs border-slate-200" />
                    <Input type="number" placeholder="Nights" value={a.days || ""}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, days: Number(e.target.value) } : x))}
                      className="h-8 text-xs border-slate-200" />
                    <Input type="number" placeholder="Amount (IDR)" value={a.amount || ""}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                      className="h-8 text-xs border-slate-200" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400"
                      onClick={() => setAccommodation(accommodation.filter((_, j) => j !== i))}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm"
                  className="text-xs gap-1.5 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                  onClick={() => setAccommodation([...accommodation, { location: "", days: 1, amount: 0 }])}>
                  <Plus size={12} /> Add Row
                </Button>
              </CardContent>
            </Card>

            {/* Remarks */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Remarks</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  rows={2} className="text-sm border-slate-200 resize-none" placeholder="Optional notes..." />
              </CardContent>
            </Card>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4 sticky top-5 self-start">
            <AllowanceSummary
              receipts={receipts} tripInfo={tripInfo}
              mealAllowanceDaily={MEAL_DAILY} transportAllowanceDaily={TRANSPORT_DAILY}
              tripType={tripType}
              startDateOverride={startDateOverride} endDateOverride={endDateOverride}
              onStartDateChange={setStartDateOverride} onEndDateChange={setEndDateOverride}
            />

            <ExpenseSummaryTable
              receipts={receipts}
              mealAllowance={mealTotal} transportAllowance={transportTotal}
              tripType={tripType}
            />

            <p className="text-[11px] text-slate-400 text-center">
              PDF: Cover → Summary → {receipts.length} receipt{receipts.length !== 1 ? "s" : ""}
            </p>

            <Button onClick={generatePDF} disabled={generating}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm">
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {generating ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
