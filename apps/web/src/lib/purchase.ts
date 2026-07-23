import { djangoFetch } from "@/lib/api/server";

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
  total_quantity: number;
  tax_amount: number;
  payment_method: string;
  confidence_score: number;
  document_url: string;
  storage_key: string;
  raw_extraction?: Record<string, unknown> | null;
  source_channel: "telegram" | "email" | "upload";
  telegram_user_id?: number | null;
  telegram_username?: string;
  is_duplicate: boolean;
  status: BillStatus;
  payment_status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseBillStats {
  processed: number;
  needs_attention: number;
  total: number;
  unpaid: number;
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
    recent_duplicates: Array<{ id: string; seller_name: string; invoice_number: string; total_rate: number; purchase_date: string }>;
  };
  top_materials: Array<{ name: string; quantity: number; total_spend: number }>;
  gst_summary: {
    total_gst_claimed: number;
    bills_with_gst: number;
  };
}

export async function getPurchaseBills(params: { status?: BillStatus } = {}) {
  const query = params.status ? `?status=${params.status}&page_size=100` : "?page_size=100";
  return djangoFetch<PurchaseBill[]>(`/api/v1/purchase/bills/${query}`);
}

export async function getPurchaseBillStats() {
  return djangoFetch<PurchaseBillStats>("/api/v1/purchase/bills/stats/");
}

export async function getPurchaseInsights() {
  return djangoFetch<PurchaseInsights>("/api/v1/purchase/bills/insights/");
}

export async function getRecentPurchaseActivity() {
  return djangoFetch<PurchaseBill[]>("/api/v1/purchase/bills/recent/");
}

export async function getVendors() {
  return djangoFetch<Vendor[]>("/api/v1/purchase/vendors/?page_size=100&ordering=name");
}
