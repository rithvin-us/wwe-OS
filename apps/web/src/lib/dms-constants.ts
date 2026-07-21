// Client-safe document types, constants, and pure helpers. No server-only
// imports here — client components (upload form, table) import from this file;
// the server fetchers live in ./dms and re-export everything below.

export type DocumentStatus = "draft" | "in_review" | "approved" | "archived";
export type DocumentCategory =
  | "contract"
  | "invoice"
  | "policy"
  | "report"
  | "correspondence"
  | "other";
export type SummaryStatus = "none" | "ready" | "failed";

// Named DocumentRecord, not Document — the latter is a global DOM type.
export interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  category_label: string;
  status: DocumentStatus;
  status_label: string;
  tags: string[];
  ai_summary: string;
  summary_status: SummaryStatus;
  file_name: string;
  file_size: number;
  content_type: string;
  owner_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "policy", label: "Policy" },
  { value: "report", label: "Report" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
