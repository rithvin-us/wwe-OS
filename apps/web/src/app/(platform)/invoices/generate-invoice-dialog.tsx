"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  TriangleAlert,
} from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

import {
  INVOICE_PREVIEW_URL,
  INVOICE_TYPE_HINTS,
  TAX_MODE_LABELS,
  emptyLine,
  formatRupees,
  invoicePdfUrl,
  invoiceWorkbookUrl,
  type BillingCustomer,
  type Invoice,
  type InvoiceLineDraft,
  type InvoicePreview,
  type InvoiceType,
} from "@/config/invoices";

import { correctInvoiceAction, generateInvoiceAction, previewInvoiceAction } from "./actions";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm " +
  "shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The month before the given date, as an `<input type="month">` value. */
function previousMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return monthValue(date.getFullYear(), date.getMonth() + 1);
}

function linesOf(invoice: Invoice): InvoiceLineDraft[] {
  return invoice.lines.map((line) => ({
    description: line.description,
    hsn: line.hsn,
    quantity: line.quantity,
    uom: line.uom,
    rate: line.rate,
  }));
}

/**
 * One dialog for both raising a bill and correcting one. Correcting recomputes
 * the whole invoice rather than patching fields, which is why the form is
 * identical in both modes — an invoice is never half-edited.
 */
export function GenerateInvoiceDialog({
  customers,
  invoice,
  trigger,
  triggerLabel = "Generate invoice",
  triggerVariant = "default",
}: {
  customers: BillingCustomer[];
  invoice?: Invoice;
  trigger?: ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary";
}) {
  const editing = invoice != null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams?.get("action") === "new" || searchParams?.get("action") === "generate") {
      setOpen(true);
    }
  }, [searchParams]);

  const initial = useMemo(
    () => ({
      invoiceType: (invoice?.invoice_type ?? "amc") as InvoiceType,
      customerId: invoice?.customer ?? "",
      invoiceDate: invoice?.invoice_date ?? today(),
      billedMonth:
        invoice?.period_year && invoice?.period_month
          ? monthValue(invoice.period_year, invoice.period_month)
          : previousMonth(invoice?.invoice_date ?? today()),
      gstRate: invoice?.gst_rate ?? "18",
      lines: invoice ? linesOf(invoice) : [emptyLine()],
    }),
    [invoice],
  );

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initial.invoiceType);
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [invoiceDate, setInvoiceDate] = useState(initial.invoiceDate);
  const [billedMonth, setBilledMonth] = useState(initial.billedMonth);
  const [gstRate, setGstRate] = useState<string>(initial.gstRate);
  const [lines, setLines] = useState<InvoiceLineDraft[]>(initial.lines);

  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Invoice | null>(null);

  // Object URLs are a browser resource, not garbage — release them.
  useEffect(() => {
    return () => {
      if (documentUrl) URL.revokeObjectURL(documentUrl);
    };
  }, [documentUrl]);

  function clearDerived() {
    setPreview(null);
    setDocumentUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function reset() {
    setInvoiceType(initial.invoiceType);
    setCustomerId(initial.customerId);
    setInvoiceDate(initial.invoiceDate);
    setBilledMonth(initial.billedMonth);
    setGstRate(initial.gstRate);
    setLines(initial.lines);
    setGenerated(null);
    clearDerived();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function updateLine(index: number, field: keyof InvoiceLineDraft, value: string) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, [field]: value } : line)),
    );
    clearDerived();
  }

  function payload() {
    const [year, month] = billedMonth.split("-");
    return {
      invoice_type: invoiceType,
      invoice_date: invoiceDate,
      customer_id: customerId,
      gst_rate: gstRate,
      period_year: invoiceType === "amc" ? Number(year) : null,
      period_month: invoiceType === "amc" ? Number(month) : null,
      lines: lines
        .filter((line) => line.description.trim())
        .map((line) => ({
          description: line.description.trim(),
          hsn: line.hsn.trim(),
          quantity: line.quantity || "1",
          uom: line.uom.trim() || "Nos",
          rate: line.rate || "0",
        })),
    };
  }

  function validate(): string | null {
    if (!customerId) return "Choose the customer or site this bill is for.";
    if (!lines.some((line) => line.description.trim())) return "Add at least one line item.";
    return null;
  }

  async function handlePreview() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const result = await previewInvoiceAction(payload());
    setBusy(false);
    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }
    setPreview(result.data);
  }

  async function handlePreviewDocument() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(INVOICE_PREVIEW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!response.ok) {
        toast.error("Could not build the document preview.");
        return;
      }
      const blob = await response.blob();
      setDocumentUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    const result = editing
      ? await correctInvoiceAction(invoice.id, payload())
      : await generateInvoiceAction(payload());
    setBusy(false);
    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }
    setGenerated(result.data);
    clearDerived();
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={triggerVariant}>
            <Plus className="mr-2 size-4" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Correct invoice ${invoice.number}` : "Invoice generation"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "The invoice is recomputed and both documents are regenerated under the same number. The previous copies are replaced."
              : "Fills the company invoice format, files it under this month's folder, and takes the next number from the bill register."}
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <GeneratedSummary
            invoice={generated}
            editing={editing}
            onAnother={reset}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-type">Invoice type</Label>
                <select
                  id="invoice-type"
                  className={SELECT_CLASS}
                  value={invoiceType}
                  onChange={(event) => {
                    setInvoiceType(event.target.value as InvoiceType);
                    clearDerived();
                  }}
                >
                  <option value="amc">AMC</option>
                  <option value="sales">Sales</option>
                </select>
                <p className="text-xs text-muted-foreground">{INVOICE_TYPE_HINTS[invoiceType]}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invoice-date">Invoice date</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => {
                    setInvoiceDate(event.target.value);
                    setBilledMonth(previousMonth(event.target.value || today()));
                    clearDerived();
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer">Customer / site</Label>
                <select
                  id="customer"
                  className={SELECT_CLASS}
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    clearDerived();
                  }}
                >
                  <option value="">Select…</option>
                  {customers.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                      {entry.is_sez ? " · SEZ" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gst-rate">GST rate</Label>
                <select
                  id="gst-rate"
                  className={SELECT_CLASS}
                  value={gstRate}
                  onChange={(event) => {
                    setGstRate(event.target.value);
                    clearDerived();
                  }}
                >
                  <option value="18">18% (9% CGST + 9% SGST)</option>
                  <option value="16">16% (8% CGST + 8% SGST)</option>
                  <option value="12">12% (6% CGST + 6% SGST)</option>
                  <option value="5">5% (2.5% CGST + 2.5% SGST)</option>
                  <option value="0">0% (Exempt / Nil Rated)</option>
                </select>
              </div>
            </div>

            {invoiceType === "amc" ? (
              <div className="space-y-1.5">
                <Label htmlFor="billed-month">Month being billed</Label>
                <Input
                  id="billed-month"
                  type="month"
                  className="sm:w-56"
                  value={billedMonth}
                  onChange={(event) => {
                    setBilledMonth(event.target.value);
                    clearDerived();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Printed on the invoice as &ldquo;For the month of …&rdquo;. Defaults to the month
                  before the invoice date.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLines((current) => [...current, emptyLine()]);
                    clearDerived();
                  }}
                >
                  <Plus className="mr-2 size-4" /> Add row
                </Button>
              </div>

              <div className="space-y-2">
                <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
                  <span className="col-span-4">Description</span>
                  <span className="col-span-2">HSN</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-1">UOM</span>
                  <span className="col-span-2">Rate</span>
                  <span className="col-span-1" />
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <Input
                      className="col-span-12 sm:col-span-4"
                      placeholder="Description"
                      value={line.description}
                      onChange={(event) => updateLine(index, "description", event.target.value)}
                    />
                    <Input
                      className="col-span-4 sm:col-span-2"
                      placeholder="HSN"
                      value={line.hsn}
                      onChange={(event) => updateLine(index, "hsn", event.target.value)}
                    />
                    <Input
                      className="col-span-3 sm:col-span-2"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(event) => updateLine(index, "quantity", event.target.value)}
                    />
                    <Input
                      className="col-span-2 sm:col-span-1"
                      placeholder="Nos"
                      value={line.uom}
                      onChange={(event) => updateLine(index, "uom", event.target.value)}
                    />
                    <Input
                      className="col-span-3 sm:col-span-2"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={line.rate}
                      onChange={(event) => updateLine(index, "rate", event.target.value)}
                    />
                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={lines.length === 1}
                        onClick={() => {
                          setLines((current) => current.filter((_, at) => at !== index));
                          clearDerived();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Real-time Subtotal & High-Value Sanity Guard */}
              {(() => {
                const currentSubtotal = lines.reduce((acc, item) => {
                  const qty = Number.parseFloat(item.quantity) || 0;
                  const rate = Number.parseFloat(item.rate) || 0;
                  return acc + qty * rate;
                }, 0);
                const highValue = currentSubtotal > 1000000;
                return (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between px-1 font-mono text-xs">
                      <span className="text-muted-foreground">
                        Calculated Subtotal (excl. tax):
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatRupees(currentSubtotal)}
                      </span>
                    </div>

                    {highValue ? (
                      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground dark:border-amber-500/30 dark:bg-amber-500/15">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            High Invoice Amount Alert ({formatRupees(currentSubtotal)})
                          </p>
                          <p className="text-muted-foreground">
                            Please verify rate and quantity. If rate contains accidental zeroes
                            (e.g. 40,05,36,000 instead of 40,053.60), correct it above before
                            saving.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>

            {preview ? <PreviewPanel preview={preview} /> : null}
            {documentUrl ? <DocumentPreview url={documentUrl} /> : null}
          </div>
        )}

        {generated ? null : (
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={handlePreview}>
              Check figures
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={handlePreviewDocument}
            >
              <FileText className="mr-2 size-4" /> Preview document
            </Button>
            <Button type="button" disabled={busy} onClick={handleSubmit}>
              {busy ? "Working…" : editing ? "Save correction" : "Generate invoice"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentPreview({ url }: { url: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Document preview — watermarked, no number taken yet
        </p>
        <Button asChild size="sm" variant="ghost">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 size-4" /> Open full size
          </a>
        </Button>
      </div>
      <iframe
        src={url}
        title="Invoice preview"
        className="h-[460px] w-full rounded-lg border border-border bg-muted/30"
      />
    </div>
  );
}

function PreviewPanel({ preview }: { preview: InvoicePreview }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-foreground">{preview.number}</p>
          <p className="text-xs text-muted-foreground">
            {preview.consignee_name || "—"}
            {preview.facility ? ` · ${preview.facility}` : ""}
          </p>
        </div>
        <Badge variant={preview.is_sez ? "warning" : "secondary"}>
          {TAX_MODE_LABELS[preview.tax_mode]}
        </Badge>
      </div>

      {preview.period_text ? (
        <p className="text-xs text-muted-foreground">{preview.period_text}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <Figure label="Subtotal" value={preview.subtotal} />
        {preview.tax_mode === "igst" ? (
          <Figure label={`IGST ${preview.gst_rate}%`} value={preview.igst_amount} />
        ) : (
          <>
            <Figure
              label={`CGST ${(Number.parseFloat(preview.gst_rate || "18") / 2).toString()}%`}
              value={preview.cgst_amount}
            />
            <Figure
              label={`SGST ${(Number.parseFloat(preview.gst_rate || "18") / 2).toString()}%`}
              value={preview.sgst_amount}
            />
          </>
        )}
        <Figure label="Round off" value={preview.round_off} />
        <Figure label="Total" value={preview.total} emphasis />
      </dl>

      <p className="text-xs text-muted-foreground">{preview.amount_in_words}</p>
      <p className="text-xs text-muted-foreground">
        {preview.lines.length} line item{preview.lines.length === 1 ? "" : "s"} · number not taken
        until you generate.
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasis
            ? "font-mono text-sm font-semibold text-foreground"
            : "font-mono text-sm text-foreground"
        }
      >
        {formatRupees(value)}
      </dd>
    </div>
  );
}

function GeneratedSummary({
  invoice,
  editing,
  onAnother,
  onClose,
}: {
  invoice: Invoice;
  editing: boolean;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-success/10 p-4">
        <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Invoice {invoice.number}{" "}
            {editing ? `corrected — revision ${invoice.revision}` : "generated"} —{" "}
            {formatRupees(invoice.total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.consignee_name}
            {invoice.facility ? ` · ${invoice.facility}` : ""} · {TAX_MODE_LABELS[invoice.tax_mode]}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Saved to</p>
        {[invoice.local_path, invoice.pdf_local_path].filter(Boolean).map((path) => (
          <p
            key={path}
            className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground"
          >
            {path}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice.pdf_url ? (
          <Button asChild size="sm" variant="outline">
            <a href={invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
              <FileText className="mr-2 size-4" /> Open PDF
            </a>
          </Button>
        ) : null}
        {invoice.download_url ? (
          <Button asChild size="sm" variant="outline">
            <a href={invoiceWorkbookUrl(invoice.id)}>
              <Download className="mr-2 size-4" /> Workbook
            </a>
          </Button>
        ) : null}
        {editing ? null : (
          <Button size="sm" variant="secondary" onClick={onAnother}>
            Generate another
          </Button>
        )}
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
