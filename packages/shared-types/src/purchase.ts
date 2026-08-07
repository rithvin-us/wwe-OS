/**
 * Mirrors `modules/purchase/backend/serializers/purchase_bill.py` field-for-
 * field, verified against a real `POST /api/v1/purchase/bills/upload/`
 * response (not just read off `apps/web/src/lib/purchase.ts`, which
 * mistypes `total_quantity`/`tax_amount`/`confidence_score` as `number` —
 * DRF's `DecimalField` serializes to a string on the wire, and a live test
 * call confirmed all three come back quoted).
 */

export interface Vendor {
  id: string;
  name: string;
  is_active: boolean;
  gst_number: string;
}

export type BillStatus = "processed" | "needs_attention";
export type PaymentStatus = "unpaid" | "paid";

export interface LineItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  tax: number;
  total: number;
}

export interface PurchaseBillTag {
  id: string;
  name: string;
  color: string;
}

export interface PurchaseBill {
  id: string;
  vendor: Vendor | null;
  seller_name: string;
  purchase_date: string;
  invoice_number: string;
  invoice_date: string | null;
  gst_number: string;
  total_rate: string;
  currency: string;
  items: LineItem[];
  total_quantity: string;
  tax_amount: string;
  payment_method: string;
  confidence_score: string;
  document_url: string;
  storage_key: string;
  raw_extraction?: Record<string, unknown> | null;
  source_channel: "telegram" | "email" | "upload";
  telegram_user_id: number | null;
  telegram_username: string;
  is_duplicate: boolean;
  status: BillStatus;
  payment_status: PaymentStatus;
  paid_at: string | null;
  tags: PurchaseBillTag[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseInsights {
  overview: {
    total_bills: number;
    processed_count: number;
    needs_attention_count: number;
    total_spend: number;
    total_gst: number;
  };
  monthly_spend: Array<{ period: string; amount: number; count: number }>;
  vendor_analysis: Array<{ id: string; name: string; total_spend: number; bills_count: number }>;
  duplicate_detection: {
    duplicates_count: number;
    recent_duplicates: Array<{
      id: string;
      seller_name: string;
      invoice_number: string;
      total_rate: number;
      purchase_date: string;
    }>;
  };
  top_materials: Array<{ name: string; quantity: number; total_spend: number }>;
  gst_summary: {
    total_gst_claimed: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    bills_with_gst: number;
  };
}

/** PATCH /api/v1/purchase/bills/{id}/update-bill/ — OCR correction. */
export interface UpdateBillPayload {
  seller_name?: string;
  invoice_number?: string;
  total_rate?: number;
  gst_number?: string;
  vendor_name?: string;
  purchase_date?: string;
  currency?: string;
  payment_method?: string;
}

export interface CreateVendorPayload {
  name: string;
  gst_number: string;
}

export interface UpdateVendorPayload {
  name?: string;
  gst_number?: string;
  is_active?: boolean;
}
