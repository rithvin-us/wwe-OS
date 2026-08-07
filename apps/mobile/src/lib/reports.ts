import type {
  ReportCatalogEntry,
  ReportExportRecord,
  RunReportInput,
  RunReportResult,
  SignedUrlResult,
} from "@bop/shared-types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api, API_URL } from "@/lib/api";

export function getReportCatalog() {
  return api.request<ReportCatalogEntry[]>("/api/v1/reporting/catalog/");
}

export function getReportHistory() {
  return api.request<ReportExportRecord[]>(
    "/api/v1/reporting/exports/?page_size=50&ordering=-created_at",
  );
}

export function runReport(input: RunReportInput) {
  return api.request<RunReportResult>("/api/v1/reporting/run/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getExportSignedUrl(id: string, expiresSeconds = 600) {
  return api.request<SignedUrlResult>(
    `/api/v1/reporting/exports/${id}/url/?expires=${expiresSeconds}`,
  );
}

/**
 * Reports don't use the JWT-direct-passthrough pattern every other module
 * uses — `download_url` is a signing-token-authorized link
 * (`StorageService.signed_url`), not a Bearer-gated endpoint. It's either an
 * absolute S3/R2 URL or a Django-relative `/api/v1/storage/download/?token=`
 * path; only the relative case needs the API host prefixed. No
 * Authorization header — the token in the URL *is* the credential.
 */
export async function downloadReportFile(downloadUrl: string): Promise<void> {
  const url = downloadUrl.startsWith("http") ? downloadUrl : `${API_URL}${downloadUrl}`;
  const file = await File.downloadFileAsync(url, Paths.cache, { idempotent: true });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}
