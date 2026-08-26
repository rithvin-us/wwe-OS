"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch, getAccessToken, internalApiUrl } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const BASE = "/api/v1/documents/documents";

const INVALID_ID_MESSAGE = "Invalid record id.";

/** Document and version ids are UUID primary keys. Anything else is a path-traversal attempt. */
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new Error(INVALID_ID_MESSAGE);
  }
  return id;
}

function assertVersion(version: number): number {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(INVALID_ID_MESSAGE);
  }
  return version;
}

export async function summarizeDocumentAction(id: string): Promise<ActionResult> {
  try {
    return await post(`${BASE}/${assertId(id)}/summarize/`, "Summary regenerated.", id);
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function archiveDocumentAction(id: string): Promise<ActionResult> {
  try {
    return await post(`${BASE}/${assertId(id)}/archive/`, "Document archived.", id);
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${assertId(id)}/`, { method: "DELETE" });
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
    const response = await fetch(`${internalApiUrl()}${BASE}/${assertId(id)}/versions/`, {
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
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function restoreVersionAction(id: string, version: number): Promise<ActionResult> {
  try {
    return await post(
      `${BASE}/${assertId(id)}/versions/${assertVersion(version)}/restore/`,
      `Restored version ${version}.`,
      id,
    );
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function shareDocumentAction(
  id: string,
): Promise<ActionResult & { url?: string; expiresIn?: number }> {
  try {
    const data = await djangoFetch<{ url: string; expires_in: number }>(
      `${BASE}/${assertId(id)}/share/?expires=3600`,
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
  if (error instanceof Error && error.message === INVALID_ID_MESSAGE) return error.message;
  return "Something went wrong. Try again.";
}
