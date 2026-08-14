/** Invoicing types and labels — client-safe (no server-only imports), shared
 * between the Invoices app, the Automation tab's Invoice Generation entry, and
 * the server-only fetchers in @/lib/invoices. */

export type InvoiceType = "amc" | "sales";
export type TaxMode = "cgst_sgst" | "igst";
export type InvoiceStatus = "issued" | "cancelled";
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
  cancelled: "Cancelled",
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
