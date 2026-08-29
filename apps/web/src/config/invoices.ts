/** Invoicing types and labels — client-safe (no server-only imports), shared
 * between the Invoices app, the Automation tab's Invoice Generation entry, and
 * the server-only fetchers in @/lib/invoices. */

export type InvoiceType = "amc" | "sales";
export type TaxMode = "cgst_sgst" | "igst";
export type InvoiceStatus = "issued" | "approved" | "on_hold" | "declined" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";
export type LifecycleStage = "generated" | "sent" | "paid" | "overdue" | "cancelled";

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  generated: "Generated",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const LIFECYCLE_BADGE_VARIANT: Record<
  LifecycleStage,
  "secondary" | "outline" | "success" | "destructive"
> = {
  generated: "outline",
  sent: "secondary",
  paid: "success",
  overdue: "destructive",
  cancelled: "secondary",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Issued",
  approved: "Approved",
  on_hold: "On Hold",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_BADGE_VARIANTS: Record<
  InvoiceStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  issued: "secondary",
  approved: "success",
  on_hold: "warning",
  declined: "destructive",
  cancelled: "destructive",
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  amc: "AMC",
  sales: "Sales",
};

export const INVOICE_TYPE_HINTS: Record<InvoiceType, string> = {
  amc: "Carries the billed month automatically — the month before the invoice date.",
  sales: "One or more products or services, each on its own row.",
};

export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  cgst_sgst: "CGST + SGST",
  igst: "IGST",
};

export interface BillingCustomer {
  id: string;
  name: string;
  address: string;
  facility: string;
  gstin: string;
  state: string;
  is_sez: boolean;
  is_active: boolean;
}

export interface InvoiceLineDraft {
  description: string;
  hsn: string;
  quantity: string;
  uom: string;
  rate: string;
}

export interface InvoiceLine {
  position: number;
  description: string;
  hsn: string;
  quantity: string;
  uom: string;
  rate: string;
  amount: string;
}

export interface Invoice {
  id: string;
  number: string;
  invoice_type: InvoiceType;
  financial_year: string;
  sequence_number: number;
  invoice_date: string;
  customer: string | null;
  customer_name: string;
  consignee_name: string;
  consignee_address: string;
  facility: string;
  gstin: string;
  is_sez: boolean;
  tax_mode: TaxMode;
  gst_rate: string;
  period_year: number | null;
  period_month: number | null;
  period_text: string;
  subtotal: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  round_off: string;
  total: string;
  amount_in_words: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  lifecycle_stage: LifecycleStage;
  is_overdue: boolean;
  /** Whether the register will accept a delete — true only while the bill is
   * still `generated`. Decided by the API, not re-derived here. */
  can_delete: boolean;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  revision: number;
  local_path: string;
  pdf_local_path: string;
  lines: InvoiceLine[];
  download_url: string | null;
  pdf_url: string | null;
  generated_by: string | null;
  created_at: string;
}

export interface InvoicePreview {
  number: string;
  sequence_number: number;
  financial_year: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  consignee_name: string;
  consignee_address: string;
  facility: string;
  gstin: string;
  is_sez: boolean;
  tax_mode: TaxMode;
  gst_rate: string;
  period_text: string;
  is_amc: boolean;
  lines: InvoiceLine[];
  subtotal: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  round_off: string;
  total: string;
  amount_in_words: string;
}

export interface NextInvoiceNumber {
  financial_year: string;
  sequence_number: number;
  number: string;
}

export function emptyLine(): InvoiceLineDraft {
  return { description: "", hsn: "", quantity: "1", uom: "Nos", rate: "" };
}

/* -------------------------------------------------------------------------- */
/* Bulk historical-invoice import (OCR)                                        */
/* -------------------------------------------------------------------------- */

export type ImportItemStatus =
  | "queued"
  | "processing"
  | "extracted"
  | "needs_attention"
  | "committed"
  | "failed"
  | "discarded";

export type ImportBatchStatus = "processing" | "review" | "completed" | "archived";

export const IMPORT_ITEM_STATUS_LABELS: Record<ImportItemStatus, string> = {
  queued: "Queued",
  processing: "Reading…",
  extracted: "Ready to review",
  needs_attention: "Needs attention",
  committed: "Committed",
  failed: "Failed",
  discarded: "Discarded",
};

export const IMPORT_ITEM_BADGE_VARIANTS: Record<
  ImportItemStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  queued: "outline",
  processing: "secondary",
  extracted: "default",
  needs_attention: "warning",
  committed: "success",
  failed: "destructive",
  discarded: "secondary",
};

/** OCR at or above this confidence reads as trustworthy in the review grid —
 * the ring turns green, matching the backend's own review threshold default. */
export const IMPORT_CONFIDENCE_OK = 0.75;

export interface ImportDraftLine {
  description: string;
  hsn: string;
  quantity: string;
  uom: string;
  rate: string;
}

/** The operator-editable draft an item carries — the invoice it will become.
 * Mirrors the generate payload plus the printed `number`. All strings so it
 * survives the round-trip through the backend's JSON draft field. */
export interface ImportDraft {
  number: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  customer_id: string | null;
  consignee_name: string;
  consignee_address: string;
  facility: string;
  gstin: string;
  is_sez: boolean;
  gst_rate: string;
  period_year: number | null;
  period_month: number | null;
  lines: ImportDraftLine[];
}

export interface ImportItem {
  id: string;
  batch: string;
  status: ImportItemStatus;
  original_filename: string;
  confidence_score: string;
  proposed_number: string;
  proposed_invoice_date: string | null;
  proposed_total: string;
  proposed: Partial<ImportDraft>;
  raw_extraction: Record<string, unknown>;
  error_message: string;
  invoice: string | null;
  invoice_number: string | null;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface ImportBatchCounts {
  total: number;
  queued: number;
  processing: number;
  extracted: number;
  needs_attention: number;
  committed: number;
  failed: number;
  discarded: number;
}

export interface ImportBatch {
  id: string;
  label: string;
  status: ImportBatchStatus;
  created_by: string | null;
  counts: ImportBatchCounts;
  created_at: string;
  updated_at: string;
}

export interface ImportBatchDetail extends ImportBatch {
  items: ImportItem[];
}

/** Serve the original scan through this app's own proxy — the browser holds no
 * Django token. */
export function importScanUrl(itemId: string): string {
  return `/api/finance/invoice-import-items/${itemId}/scan`;
}

/** Fill a possibly-partial draft (a still-`queued` item's is `{}`) to a complete
 * one the review form can bind to. */
export function toImportDraft(proposed: Partial<ImportDraft> | undefined): ImportDraft {
  return {
    number: proposed?.number ?? "",
    invoice_type: proposed?.invoice_type ?? "sales",
    invoice_date: proposed?.invoice_date ?? "",
    customer_id: proposed?.customer_id ?? null,
    consignee_name: proposed?.consignee_name ?? "",
    consignee_address: proposed?.consignee_address ?? "",
    facility: proposed?.facility ?? "",
    gstin: proposed?.gstin ?? "",
    is_sez: proposed?.is_sez ?? false,
    gst_rate: proposed?.gst_rate ?? "18",
    period_year: proposed?.period_year ?? null,
    period_month: proposed?.period_month ?? null,
    lines: proposed?.lines?.length ? proposed.lines : [emptyLine()],
  };
}

/** Document links go through this app's own proxy routes — the browser never
 * holds a Django token, so it can't call the backend directly. */
export function invoiceWorkbookUrl(id: string): string {
  return `/api/finance/invoices/${id}/download`;
}

export function invoicePdfUrl(id: string): string {
  return `/api/finance/invoices/${id}/pdf`;
}

export const INVOICE_PREVIEW_URL = "/api/finance/invoice-preview";

/** Indian rupee formatting for on-screen figures. The workbook does its own. */
export function formatRupees(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value || "0");
  if (Number.isNaN(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatInvoiceDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
