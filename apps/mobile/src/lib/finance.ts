import type {
  BillingCustomer,
  GenerateInvoiceInput,
  Invoice,
  InvoicePreview,
  NextInvoiceNumber,
  SaveCustomerInput,
} from "@bop/shared-types";
import { File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api, API_URL } from "@/lib/api";
import { secureTokenStorage } from "@/lib/token-storage";

export function getBillingCustomers() {
  return api.request<BillingCustomer[]>("/api/v1/finance/customers/?ordering=name&page_size=200");
}

export function saveCustomer(input: SaveCustomerInput, id?: string) {
  return id
    ? api.request<BillingCustomer>(`/api/v1/finance/customers/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    : api.request<BillingCustomer>("/api/v1/finance/customers/", {
        method: "POST",
        body: JSON.stringify(input),
      });
}

export function deleteCustomer(id: string) {
  return api.request<null>(`/api/v1/finance/customers/${id}/`, { method: "DELETE" });
}

export function getInvoices() {
  return api.request<Invoice[]>(
    "/api/v1/finance/invoices/?ordering=-sequence_number&page_size=100",
  );
}

export function getInvoice(id: string) {
  return api.request<Invoice>(`/api/v1/finance/invoices/${id}/`);
}

export function getNextInvoiceNumber() {
  return api.request<NextInvoiceNumber>("/api/v1/finance/invoices/next-number/");
}

export function previewInvoice(input: GenerateInvoiceInput) {
  return api.request<InvoicePreview>("/api/v1/finance/invoices/preview/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function generateInvoice(input: GenerateInvoiceInput) {
  return api.request<Invoice>("/api/v1/finance/invoices/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Correcting is always a full recompute under the same number+revision bump, never a partial patch. */
export function correctInvoice(id: string, input: GenerateInvoiceInput) {
  return api.request<Invoice>(`/api/v1/finance/invoices/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function cancelInvoice(id: string, reason: string) {
  return api.request<Invoice>(`/api/v1/finance/invoices/${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** GET, JWT-gated binary passthrough — same pattern as Purchase's bill file. */
export async function openInvoicePdf(id: string): Promise<void> {
  await downloadAndShare(`/api/v1/finance/invoices/${id}/pdf/`);
}

export async function openInvoiceWorkbook(id: string): Promise<void> {
  await downloadAndShare(`/api/v1/finance/invoices/${id}/download/`);
}

async function downloadAndShare(path: string): Promise<void> {
  const token = await secureTokenStorage.getAccessToken();
  const file = await File.downloadFileAsync(`${API_URL}${path}`, Paths.cache, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}

/**
 * POST /invoices/preview-document/ — a watermarked PDF rendered from unsaved
 * draft figures, no file written server-side. Unlike the two endpoints
 * above this is a POST with a JSON body, so `File.downloadFileAsync` (GET
 * only) doesn't apply — fetch the bytes directly and write them out via the
 * legacy FileSystem API (still a first-class export, not a shim).
 */
export async function previewInvoiceDocument(input: GenerateInvoiceInput): Promise<void> {
  const token = await secureTokenStorage.getAccessToken();
  const response = await fetch(`${API_URL}/api/v1/finance/invoices/preview-document/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Preview failed (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const fileUri = `${LegacyFileSystem.cacheDirectory}invoice-preview.pdf`;
  await LegacyFileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Hermes (RN's JS engine) has global btoa/atob — no Buffer polyfill needed.
  return btoa(binary);
}
