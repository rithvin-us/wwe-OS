"use server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface RunResult {
  ok: boolean;
  message: string;
  downloadUrl?: string;
  filename?: string;
}

export async function runReportAction(key: string, format: string): Promise<RunResult> {
  try {
    const result = await djangoFetch<{ download_url: string | null; filename: string | null }>(
      "/api/v1/reporting/run/",
      { method: "POST", body: JSON.stringify({ key, format }) },
    );
    const url = result.download_url;
    if (!url) {
      return { ok: false, message: "The report produced no downloadable file." };
    }
    // S3/R2 presign as an absolute URL the browser can open directly. The local
    // provider signs a Django-relative token URL the browser can't reach, so
    // route those through our storage proxy carrying the token.
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return {
        ok: true,
        message: "Report ready.",
        downloadUrl: url,
        filename: result.filename ?? undefined,
      };
    }
    const token = new URLSearchParams(url.split("?")[1] ?? "").get("token");
    if (!token) {
      return { ok: false, message: "The report produced no downloadable file." };
    }
    return {
      ok: true,
      message: "Report ready.",
      downloadUrl: `/api/storage/download?token=${encodeURIComponent(token)}`,
      filename: result.filename ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiRequestError ? error.message : "Couldn't run the report.",
    };
  }
}
