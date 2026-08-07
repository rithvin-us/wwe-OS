/**
 * Mirrors `platform/reporting` — a platform app, not `modules/reports`
 * (that directory is an empty scaffold). On-demand only: catalog, run,
 * history. Scheduling ("on schedule" in the web tagline) is a separate
 * app, `platform/automation`, not ported here.
 */

export type ReportFormat = "csv" | "xlsx" | "pdf" | "html";

export interface ReportCatalogEntry {
  key: string;
  label: string;
  module: string;
  description: string;
}

export interface ReportExportRecord {
  id: string;
  report_key: string;
  title: string;
  module: string;
  format: string;
  row_count: number;
  params: Record<string, unknown>;
  filename: string | null;
  created_at: string;
}

/** POST /api/v1/reporting/run/ body. */
export interface RunReportInput {
  key: string;
  format: ReportFormat;
  date_from?: string;
  date_to?: string;
  vendor?: string;
  tag_ids?: string[];
}

/** POST /api/v1/reporting/run/ response — download_url may be null. */
export interface RunReportResult {
  id: string;
  filename: string | null;
  row_count: number;
  download_url: string | null;
}

/** GET /api/v1/reporting/exports/{id}/url/ response. */
export interface SignedUrlResult {
  url: string;
  expires_in: number;
}
