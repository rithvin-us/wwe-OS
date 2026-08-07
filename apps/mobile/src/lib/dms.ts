import type { DocumentCategory, DocumentRecord, DocumentStatus } from "@bop/shared-types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api, API_URL } from "@/lib/api";
import type { LocalFile } from "@/lib/local-file";
import { secureTokenStorage } from "@/lib/token-storage";

const BASE = "/api/v1/documents/documents";

export function getDocuments(
  params: { status?: DocumentStatus; category?: DocumentCategory } = {},
) {
  const query = new URLSearchParams({ page_size: "100", ordering: "-created_at", ...params });
  return api.request<DocumentRecord[]>(`${BASE}/?${query}`);
}

export function getDocument(id: string) {
  return api.request<DocumentRecord>(`${BASE}/${id}/`);
}

export interface UploadDocumentInput {
  file: LocalFile;
  title: string;
  category: DocumentCategory;
  description?: string;
  tags?: string[];
}

export function uploadDocument(input: UploadDocumentInput) {
  const form = new FormData();
  form.append("file", {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.type,
  } as unknown as Blob);
  form.append("title", input.title);
  form.append("category", input.category);
  if (input.description) form.append("description", input.description);
  for (const tag of input.tags ?? []) form.append("tags", tag);

  return api.request<DocumentRecord>(`${BASE}/`, { method: "POST", body: form });
}

export function summarizeDocument(id: string) {
  return api.request<DocumentRecord>(`${BASE}/${id}/summarize/`, { method: "POST" });
}

export function archiveDocument(id: string) {
  return api.request<DocumentRecord>(`${BASE}/${id}/archive/`, { method: "POST" });
}

export function deleteDocument(id: string) {
  return api.request<null>(`${BASE}/${id}/`, { method: "DELETE" });
}

/** GET, JWT-gated binary passthrough — no inline preview on web either, download-and-share only. */
export async function openDocument(id: string): Promise<void> {
  const token = await secureTokenStorage.getAccessToken();
  const file = await File.downloadFileAsync(`${API_URL}${BASE}/${id}/download/`, Paths.cache, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}
