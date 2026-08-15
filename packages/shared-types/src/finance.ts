/**
 * Mirrors `apps/web/src/config/invoices.ts` field-for-field, cross-checked
 * against `modules/finance/backend/serializers/invoice.py`. Same wire gotcha
 * as `purchase.ts`: every decimal field (`total`, `subtotal`, `*_amount`,
 * `round_off`, `gst_rate`, `quantity`, `rate`, `amount`) is a DRF
 * `DecimalField` and comes back as a string, not a number.
 */

export type InvoiceType = "amc" | "sales";
export type TaxMode = "cgst_sgst" | "igst";
export type InvoiceStatus = "issued" | "approved" | "on_hold" | "declined" | "cancelled";

export interface BillingCustomer {
  id: string;
  name: string;
  address: string;
  facility: string;
  gstin: string;
  state: string;
  is_sez: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A line as typed into the generate/correct form — no position/amount yet. */
export interface InvoiceLineDraft {
  description: string;
  hsn: string;
  quantity: string;
  uom: string;
  rate: string;
}

/** A line as returned by the server — position and computed amount included. */
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

/** POST /invoices/, POST /invoices/preview/, PATCH /invoices/{id}/ — same shape. */
export interface GenerateInvoiceInput {
  invoice_type: InvoiceType;
  invoice_date: string;
  customer_id?: string;
  consignee_name?: string;
  consignee_address?: string;
  facility?: string;
  gstin?: string;
  is_sez?: boolean;
  gst_rate?: string;
  period_year?: number;
  period_month?: number;
  lines: InvoiceLineDraft[];
}

export interface SaveCustomerInput {
  name: string;
  address?: string;
  facility?: string;
  gstin?: string;
  state?: string;
  is_sez?: boolean;
}

/** The ₹10L pre-submit warning threshold — same as apps/web's generate-invoice-dialog.tsx. */
export const HIGH_VALUE_THRESHOLD = 1_000_000;

export function computeSubtotal(lines: InvoiceLineDraft[]): number {
  return lines.reduce((acc, line) => {
    const qty = Number.parseFloat(line.quantity) || 0;
    const rate = Number.parseFloat(line.rate) || 0;
    return acc + qty * rate;
  }, 0);
}

export function formatRupees(value: string | number): string {
  const n = typeof value === "string" ? Number.parseFloat(value) || 0 : value;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
