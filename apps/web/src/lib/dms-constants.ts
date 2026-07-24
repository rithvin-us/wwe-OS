// Client-safe document types, constants, and pure helpers. No server-only
// imports here — client components (upload form, table) import from this file;
// the server fetchers live in ./dms and re-export everything below.

export type DocumentStatus = "active" | "archived";
export type DocumentCategory =
  | "contract"
  | "invoice"
  | "policy"
  | "po"
  | "report"
  | "purchase_bill"
  | "correspondence"
  | "other";
export type SummaryStatus = "none" | "ready" | "failed";

// A tag as the API returns it — see packages/ui/src/components/tag-pill.tsx
// for the shared TagLike shape every module's tags conform to.
export interface DocumentTag {
  id: string;
  name: string;
  color: "blue" | "green" | "amber" | "violet" | "rose";
}

// Named DocumentRecord, not Document — the latter is a global DOM type.
export interface DocumentRecord {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  category_label: string;
  status: DocumentStatus;
  status_label: string;
  tags: DocumentTag[];
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
  { value: "po", label: "PO" },
  { value: "report", label: "Report" },
  { value: "purchase_bill", label: "Purchase Bill" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
