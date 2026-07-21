import { djangoFetch } from "@/lib/api/server";

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

export async function getReportCatalog() {
  return djangoFetch<ReportCatalogEntry[]>("/api/v1/reporting/catalog/");
}

export async function getReportHistory() {
  return djangoFetch<ReportExportRecord[]>(
    "/api/v1/reporting/exports/?page_size=50&ordering=-created_at",
  );
}
