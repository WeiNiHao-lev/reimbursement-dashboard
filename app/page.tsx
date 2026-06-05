"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
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

export default function Home() {
  const [tripType, setTripType] = useState<"domestic" | "overseas">("domestic");
  const [employeeName, setEmployeeName] = useState("Daffa Khairi");
  const [department, setDepartment] = useState("Marketing Department");
  const [residence, setResidence] = useState("Jakarta");
  const [purpose, setPurpose] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  });
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
        tripType,
        employeeName,
        department,
        permanentResidence: residence,
        purpose,
        month,
        tripInfo,
        receipts: receipts.map((r) => r.data),
        accommodation,
        mealAllowanceDailyIDR: MEAL_DAILY,
        transportAllowanceDailyIDR: TRANSPORT_DAILY,
        mealAllowanceDailyCNY: 100,
        exchangeRate1: 2300,
        exchangeRate2: 2300,
        remarks,
      };

      const fd = new FormData();
      fd.append("form", JSON.stringify(form));
      receipts.forEach((r, i) => fd.append(`receipt_${i}`, r.file));

      const res = await fetch("/api/generate-pdf", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "PDF generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reimbursement ${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Reimbursement Dashboard</h1>
              <p className="text-xs text-gray-500">CCEPC Marketing Department</p>
            </div>
          </div>
          <Button onClick={generatePDF} disabled={generating} className="gap-2 bg-blue-600 hover:bg-blue-700">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {generating ? "Generating PDF…" : "Generate PDF"}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Trip type selector */}
        <Tabs value={tripType} onValueChange={(v) => setTripType(v as "domestic" | "overseas")}>
          <TabsList className="grid grid-cols-2 w-72">
            <TabsTrigger value="domestic">🇮🇩 Domestic (境内)</TabsTrigger>
            <TabsTrigger value="overseas">✈️ Overseas (境外)</TabsTrigger>
          </TabsList>
          <TabsContent value="domestic" className="mt-0" />
          <TabsContent value="overseas" className="mt-0" />
        </Tabs>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column */}
          <div className="col-span-2 space-y-5">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">基础信息 / Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Employee Name</Label>
                  <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Department</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Permanent Residence</Label>
                  <Input value={residence} onChange={(e) => setResidence(e.target.value)} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Month / Period</Label>
                  <Input value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 text-sm mt-1" placeholder="e.g. Mei 2026" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Purpose of Business Trip</Label>
                  <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-8 text-sm mt-1" placeholder="e.g. Business trip to Surabaya for project coordination" />
                </div>
              </CardContent>
            </Card>

            {/* Trip Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">出差信息 / Trip Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-2 mb-2">
                  <p className="text-xs text-gray-500 font-medium">Date</p>
                  <p className="text-xs text-gray-500 font-medium">Route (From → To)</p>
                  <p className="text-xs text-gray-500 font-medium">Vehicle</p>
                  <p className="text-xs text-gray-500 font-medium">Ticketing</p>
                  <span />
                </div>
                <TripInfoEditor rows={tripInfo} onChange={setTripInfo} />
              </CardContent>
            </Card>

            {/* Receipts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  📎 Upload Receipts
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    — AI extracts date, amount & category automatically
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReceiptDropzone onChange={setReceipts} />
              </CardContent>
            </Card>

            {/* Accommodation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">🏨 Accommodation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {accommodation.map((a, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_2fr_auto] gap-2 items-center">
                    <Input
                      placeholder="Location / City"
                      value={a.location}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Days"
                      value={a.days || ""}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, days: Number(e.target.value) } : x))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (IDR)"
                      value={a.amount || ""}
                      onChange={(e) => setAccommodation(accommodation.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                      className="h-8 text-xs"
                    />
                    <Button variant="ghost" size="sm" className="h-8 text-red-400 px-2" onClick={() => setAccommodation(accommodation.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setAccommodation([...accommodation, { location: "", days: 1, amount: 0 }])}>
                  + Add Row
                </Button>
              </CardContent>
            </Card>

            {/* Remarks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">备注 / Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="text-sm" placeholder="Optional notes..." />
              </CardContent>
            </Card>
          </div>

          {/* Right column: Summary */}
          <div className="space-y-4 sticky top-6 self-start">
            <AllowanceSummary
              receipts={receipts}
              tripInfo={tripInfo}
              mealAllowanceDaily={MEAL_DAILY}
              transportAllowanceDaily={TRANSPORT_DAILY}
              tripType={tripType}
              startDateOverride={startDateOverride}
              endDateOverride={endDateOverride}
              onStartDateChange={setStartDateOverride}
              onEndDateChange={setEndDateOverride}
            />

            <ExpenseSummaryTable
              receipts={receipts}
              mealAllowance={mealTotal}
              transportAllowance={transportTotal}
              tripType={tripType}
            />

            <p className="text-xs text-gray-400 text-center">
              PDF: Cover → Summary → {receipts.length} receipt{receipts.length !== 1 ? "s" : ""}
            </p>

            <Button onClick={generatePDF} disabled={generating} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {generating ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
