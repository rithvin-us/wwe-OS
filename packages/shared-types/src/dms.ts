/**
 * Mirrors `apps/web/src/lib/dms-constants.ts`, cross-checked against
 * `modules/documents/backend/serializers/document.py`. Note the Django app
 * is `documents`, not `dms` — the URL prefix is a double `documents/documents/`
 * segment (app mount + router registration), not a typo.
 *
 * `reviewed_at` is dropped here on purpose — the web TS type still declares
 * it but the column was removed in `migrations/0002_remove_document_reviewed_at.py`
 * and the serializer never returns it; porting it would just be dead weight.
 */

export type DocumentCategory =
  | "contract"
  | "invoice"
  | "policy"
  | "po"
  | "report"
  | "purchase_bill"
  | "correspondence"
  | "other";

export type DocumentStatus = "active" | "archived";
export type SummaryStatus = "none" | "ready" | "failed";

export interface DocumentTag {
  id: string;
  name: string;
  color: "blue" | "green" | "amber" | "violet" | "rose";
}

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
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "policy", label: "Policy" },
  { value: "po", label: "Purchase order" },
  { value: "report", label: "Report" },
  { value: "purchase_bill", label: "Purchase bill" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
