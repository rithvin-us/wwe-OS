import { djangoFetch } from "@/lib/api/server";
import type { DocumentCategory, DocumentRecord, DocumentStatus } from "@/lib/dms-constants";

// Re-export the client-safe types/constants so server callers have one import.
export * from "@/lib/dms-constants";

export async function getDocuments(
  params: { status?: DocumentStatus; category?: DocumentCategory } = {},
) {
  try {
    const query = new URLSearchParams({ page_size: "100", ordering: "-created_at" });
    if (params.status) query.set("status", params.status);
    if (params.category) query.set("category", params.category);
    return await djangoFetch<DocumentRecord[]>(`/api/v1/documents/documents/?${query.toString()}`);
  } catch {
    return [];
  }
}

export async function getDocument(id: string) {
  return djangoFetch<DocumentRecord>(`/api/v1/documents/documents/${id}/`);
}
