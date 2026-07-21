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
