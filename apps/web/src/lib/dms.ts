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

export interface DocumentVersionRecord {
  id: string;
  version: number;
  is_current: boolean;
  note: string;
  file_name: string;
  file_size: number;
  content_type: string;
  checksum: string;
  uploaded_by_email: string | null;
  created_at: string;
}

export async function getDocumentVersions(id: string) {
  try {
    return await djangoFetch<DocumentVersionRecord[]>(
      `/api/v1/documents/documents/${id}/versions/`,
    );
  } catch {
    return [];
  }
}

/** Types the browser can render inline; anything else previews as a download. */
const INLINE_PREVIEW_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);

export function canPreviewInline(contentType: string): boolean {
  return INLINE_PREVIEW_TYPES.has(contentType);
}
