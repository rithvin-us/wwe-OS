import type {
  CreateVendorPayload,
  PurchaseBill,
  PurchaseBillStats,
  PurchaseInsights,
  UpdateBillPayload,
  UpdateVendorPayload,
  Vendor,
} from "@bop/shared-types";

import { api } from "@/lib/api";
import { fileFormData, type LocalFile } from "@/lib/local-file";

export function getPurchaseBills(params: { status?: string } = {}) {
  const query = new URLSearchParams({ page_size: "100", ...params });
  return api.request<PurchaseBill[]>(`/api/v1/purchase/bills/?${query}`);
}

export function getPurchaseBill(id: string) {
  return api.request<PurchaseBill>(`/api/v1/purchase/bills/${id}/`);
}

export function getPurchaseBillStats() {
  return api.request<PurchaseBillStats>("/api/v1/purchase/bills/stats/");
}

export function getPurchaseInsights() {
  return api.request<PurchaseInsights>("/api/v1/purchase/bills/insights/");
}

export function updateBill(id: string, payload: UpdateBillPayload) {
  return api.request<PurchaseBill>(`/api/v1/purchase/bills/${id}/update-bill/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function markBillPaid(id: string) {
  return api.request<PurchaseBill>(`/api/v1/purchase/bills/${id}/mark-paid/`, { method: "POST" });
}

export function unmarkBillPaid(id: string) {
  return api.request<PurchaseBill>(`/api/v1/purchase/bills/${id}/unmark-paid/`, {
    method: "POST",
  });
}

export function deleteBill(id: string) {
  return api.request<null>(`/api/v1/purchase/bills/${id}/`, { method: "DELETE" });
}

/**
 * POST /api/v1/purchase/bills/upload/ — JWT-authenticated bill scan. Added
 * this session specifically so mobile has a real ingestion path: the
 * Telegram/email channel endpoint (`/bills/ingest/`) needs a service token
 * no client app can safely hold.
 */
export function uploadBill(photo: LocalFile) {
  const form = fileFormData("file", photo);
  return api.request<PurchaseBill>("/api/v1/purchase/bills/upload/", {
    method: "POST",
    body: form,
  });
}

/** Binary passthrough (image/pdf), not an envelope — use requestRaw like HR's register downloads. */
export function getBillFileUrl(id: string): string {
  return `/api/v1/purchase/bills/${id}/file/`;
}

export function getVendors() {
  return api.request<Vendor[]>("/api/v1/purchase/vendors/?page_size=100&ordering=name");
}

export function createVendor(payload: CreateVendorPayload) {
  return api.request<Vendor>("/api/v1/purchase/vendors/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateVendor(id: string, payload: UpdateVendorPayload) {
  return api.request<Vendor>(`/api/v1/purchase/vendors/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
