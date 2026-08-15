"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const BASE = "/api/v1/documents/documents";

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
