"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, ScanText, Sparkles } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Dropzone } from "@bop/ui/components/dropzone";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

import {
  formatRupees,
  type BillingCustomer,
  type InvoiceLineDraft,
  type InvoiceType,
} from "@/config/invoices";
import { generateInvoiceAction } from "./actions";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";

export interface ParsedPoDraft {
  customerId: string;
  invoiceType: InvoiceType;
  gstRate: string;
  lines: InvoiceLineDraft[];
  poNumber?: string;
  poDate?: string;
  customerName?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function previousMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function UploadPoDialog({ customers }: { customers: BillingCustomer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [draft, setDraft] = useState<ParsedPoDraft | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>(today());
  const [billedMonth, setBilledMonth] = useState<string>(previousMonth(today()));
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("amc");

  const [fullEditorOpen, setFullEditorOpen] = useState(false);

  function matchCustomer(extractedName: string, extractedGstin: string): string {
    if (!extractedName && !extractedGstin) return "";
    const nameLower = extractedName.toLowerCase().trim();
    const gstinClean = extractedGstin.replace(/[^A-Z0-9]/gi, "").toUpperCase();

    if (gstinClean) {
      const gstinMatch = customers.find(
        (c) => c.gstin && c.gstin.toUpperCase().includes(gstinClean),
      );
      if (gstinMatch) return gstinMatch.id;
    }

    if (nameLower) {
      const nameMatch = customers.find((c) => {
        const cName = c.name.toLowerCase();
        return cName.includes(nameLower) || nameLower.includes(cName);
      });
      if (nameMatch) return nameMatch.id;
    }

    return "";
  }

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;

    setScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/finance/po-parse", {
        method: "POST",
        body: formData,
      });

      const res = await response.json();
      setScanning(false);

      if (!response.ok || !res.ok || !res.data) {
        toast.error(res?.error || "Could not parse PO file. Please try again.");
        return;
      }

      const data = res.data;
      const matchedId = matchCustomer(data.customer_name || "", data.customer_gstin || "");

      const detectedType: InvoiceType =
        data.invoice_type === "amc" ||
        (data.lines &&
          data.lines.some(
            (l: { description: string }) =>
              l.description.toLowerCase().includes("amc") ||
              l.description.toLowerCase().includes("maintenance") ||
              l.description.toLowerCase().includes("operation"),
          ))
          ? "amc"
          : "sales";

      const parsedDraft: ParsedPoDraft = {
        customerId: matchedId,
        customerName: data.customer_name || "",
        invoiceType: detectedType,
        gstRate: data.gst_rate || "18",
        poNumber: data.po_number || "",
        poDate: data.po_date || "",
        lines: Array.isArray(data.lines)
          ? data.lines.map(
              (line: {
                description: string;
                hsn: string;
                quantity: string;
                uom: string;
                rate: string;
              }) => ({
                description: line.description || "",
                hsn: line.hsn || "",
                quantity: String(line.quantity || "1"),
                uom: line.uom || "Nos",
                rate: String(line.rate || "0"),
              }),
            )
          : [],
      };

      setDraft(parsedDraft);
      setSelectedCustomerId(matchedId);
      setInvoiceType(detectedType);
      toast.success(
        matchedId
          ? `PO parsed & customer matched (${customers.find((c) => c.id === matchedId)?.name})!`
          : "PO parsed! Please select customer below.",
      );
    } catch {
      setScanning(false);
      toast.error("Network error while parsing PO file.");
    }
  }

  async function handleOneClickGenerate() {
    if (!draft) return;
    if (!selectedCustomerId) {
      toast.error("Please choose the customer or site for this bill.");
      return;
    }

    setGenerating(true);
    const [year, month] = billedMonth.split("-");
    const payload = {
      invoice_type: invoiceType,
      invoice_date: invoiceDate,
      customer_id: selectedCustomerId,
      gst_rate: draft.gstRate || "18",
      period_year: invoiceType === "amc" ? Number(year) : null,
      period_month: invoiceType === "amc" ? Number(month) : null,
      lines: draft.lines.map((l) => ({
        description: l.description.trim(),
        hsn: l.hsn.trim(),
        quantity: l.quantity || "1",
        uom: l.uom.trim() || "Nos",
        rate: l.rate || "0",
      })),
    };

    const result = await generateInvoiceAction(payload);
    setGenerating(false);

    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }

    toast.success(`AMC Bill ${result.data.number} generated successfully!`);
    setOpen(false);
    setDraft(null);
    router.refresh();
  }

  const calculatedSubtotal = draft
    ? draft.lines.reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0)
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <FileUp className="mr-2 size-4" />
            Upload PO to convert
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Upload Purchase Order (PO)</DialogTitle>
            <DialogDescription>
              Upload an AMC or Sales PO (PDF/image). Extracted details will generate your bill with
              1-click.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {scanning ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <ScanText className="size-8 animate-pulse text-primary" />
                <p className="text-sm font-medium text-foreground">Reading Purchase Order…</p>
                <p className="text-xs text-muted-foreground">
                  Extracting line items, rates, HSN codes, and customer info
                </p>
              </div>
            ) : !draft ? (
              <Dropzone
                onFiles={handleFiles}
                accept="image/*,.pdf"
                maxSizeBytes={10 * 1024 * 1024}
                label="Drop AMC or Sales PO (PDF or Image)"
                hint="Extracts customer, AMC scope, rates, and line items"
              />
            ) : (
              <div className="space-y-4">
                {/* Extracted Summary Card */}
                <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <CheckCircle2 className="size-4 text-success" />
                      PO Extracted: {draft.poNumber ? `PO #${draft.poNumber}` : "Purchase Order"}
                    </span>
                    <span className="font-mono text-primary font-semibold">
                      {formatRupees(calculatedSubtotal)} (excl. tax)
                    </span>
                  </div>

                  {draft.lines.length > 0 ? (
                    <div className="space-y-1 pt-1 border-t border-border/50 text-muted-foreground">
                      {draft.lines.slice(0, 2).map((line, i) => (
                        <p key={i} className="truncate">
                          • {line.description} — {formatRupees(line.rate)} / {line.uom}
                        </p>
                      ))}
                      {draft.lines.length > 2 ? (
                        <p className="text-[11px] font-medium text-muted-foreground">
                          + {draft.lines.length - 2} more line items
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* 1-Click Form Controls */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="po-customer">Customer / Site</Label>
                    <select
                      id="po-customer"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="">Select Customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.is_sez ? "· SEZ" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="po-type">Bill Type</Label>
                    <select
                      id="po-type"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none"
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                    >
                      <option value="amc">AMC Bill</option>
                      <option value="sales">Sales Bill</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="po-inv-date">Invoice Date</Label>
                    <Input
                      id="po-inv-date"
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => {
                        setInvoiceDate(e.target.value);
                        setBilledMonth(previousMonth(e.target.value || today()));
                      }}
                    />
                  </div>

                  {invoiceType === "amc" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="po-month">Billed Month</Label>
                      <Input
                        id="po-month"
                        type="month"
                        value={billedMonth}
                        onChange={(e) => setBilledMonth(e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      setFullEditorOpen(true);
                    }}
                  >
                    Custom Edit / Add Lines
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraft(null)}
                    >
                      Scan Another
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={generating || !selectedCustomerId}
                      onClick={handleOneClickGenerate}
                    >
                      <Sparkles className="mr-1.5 size-4" />
                      {generating
                        ? "Generating…"
                        : invoiceType === "amc"
                          ? "Generate AMC Bill"
                          : "Generate Bill"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Full Editor Dialog */}
      {draft ? (
        <GenerateInvoiceDialog
          customers={customers}
          initialDraft={{
            customerId: selectedCustomerId,
            invoiceType,
            gstRate: draft.gstRate,
            lines: draft.lines,
          }}
          openOverride={fullEditorOpen}
          onOpenChangeOverride={(next) => {
            setFullEditorOpen(next);
            if (!next) setDraft(null);
          }}
        />
      ) : null}
    </>
  );
}
