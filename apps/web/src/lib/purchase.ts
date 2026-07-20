import { djangoFetch } from "@/lib/api/server";

export interface Vendor {
  id: string;
  name: string;
  is_active: boolean;
  gst_number: string;
}

export type BillStatus = "pending_review" | "confirmed" | "rejected";
export type PaymentStatus = "unpaid" | "paid";

export interface PurchaseBill {
  id: string;
  vendor: Vendor | null;
  seller_name: string;
  purchase_date: string;
  total_rate: string;
  currency: string;
  document_url: string;
  source_channel: "telegram" | "email" | "upload";
  status: BillStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string;
  payment_status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface PurchaseBillStats {
  pending_review: number;
  confirmed: number;
  rejected: number;
  total: number;
  unpaid_confirmed: number;
  overdue_pending: number;
}

export async function getPurchaseBills(params: { status?: BillStatus } = {}) {
  const query = params.status ? `?status=${params.status}&page_size=100` : "?page_size=100";
  return djangoFetch<PurchaseBill[]>(`/api/v1/purchase/bills/${query}`);
}

export async function getPurchaseBillStats() {
  return djangoFetch<PurchaseBillStats>("/api/v1/purchase/bills/stats/");
}

export async function getRecentPurchaseActivity() {
  return djangoFetch<PurchaseBill[]>("/api/v1/purchase/bills/recent/");
}

export async function getVendors() {
  return djangoFetch<Vendor[]>("/api/v1/purchase/vendors/?page_size=100&ordering=name");
}
