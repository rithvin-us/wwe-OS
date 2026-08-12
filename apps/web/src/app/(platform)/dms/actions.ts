"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch, getAccessToken, internalApiUrl } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const BASE = "/api/v1/documents/documents";

/**
 * Uploads carry a file, so they go out as multipart — not through
 * `djangoFetch` (which forces application/json). Still server-only: the
 * access token comes from the httpOnly cookie and never reaches the browser.
 */
export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Give the document a title." };

  try {
    const token = await getAccessToken();
    const forward = new FormData();
    forward.append("file", file);
    forward.append("title", title);
    forward.append("category", String(formData.get("category") ?? "other"));
    forward.append("description", String(formData.get("description") ?? ""));
    for (const tag of parseTags(String(formData.get("tags") ?? ""))) {
      forward.append("tags", tag);
    }

    const response = await fetch(`${internalApiUrl()}${BASE}/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: forward,
      cache: "no-store",
    });
    const envelope = await response.json();
    if (!envelope.success) {
      return { ok: false, message: envelope.error?.message ?? "Upload failed." };
    }
    revalidatePath("/dms");
    return { ok: true, message: "Document uploaded." };
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function summarizeDocumentAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/summarize/`, "Summary regenerated.", id);
}

export async function archiveDocumentAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/archive/`, "Document archived.", id);
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/dms");
    return { ok: true, message: "Document deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function addVersionAction(id: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload as the new version." };
  }
  try {
    const token = await getAccessToken();
    const forward = new FormData();
    forward.append("file", file);
    forward.append("note", String(formData.get("note") ?? ""));
    const response = await fetch(`${internalApiUrl()}${BASE}/${id}/versions/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: forward,
      cache: "no-store",
    });
    if (!response.ok) {
      const envelope = await response.json().catch(() => ({}));
      return { ok: false, message: envelope.error?.message ?? "Could not add the version." };
    }
    revalidatePath(`/dms/${id}`);
    return { ok: true, message: "New version uploaded." };
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function restoreVersionAction(id: string, version: number): Promise<ActionResult> {
  return post(`${BASE}/${id}/versions/${version}/restore/`, `Restored version ${version}.`, id);
}

export async function shareDocumentAction(
  id: string,
): Promise<ActionResult & { url?: string; expiresIn?: number }> {
  try {
    const data = await djangoFetch<{ url: string; expires_in: number }>(
      `${BASE}/${id}/share/?expires=3600`,
    );
    // The backend mints a Django-path signed URL; rewrite it to the browser-
    // facing storage proxy (same token — the token is the credential).
    const token = new URL(data.url, "http://x").searchParams.get("token") ?? "";
    return {
      ok: true,
      message: "Share link ready.",
      url: `/api/storage/download?token=${encodeURIComponent(token)}`,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

async function post(path: string, success: string, id: string): Promise<ActionResult> {
  try {
    await djangoFetch(path, { method: "POST" });
    revalidatePath("/dms");
    revalidatePath(`/dms/${id}`);
    return { ok: true, message: success };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
