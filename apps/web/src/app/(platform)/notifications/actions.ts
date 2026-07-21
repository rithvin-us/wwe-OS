"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const BASE = "/api/v1/notifications";

export async function markReadAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/read/`, "Marked as read.");
}

export async function markArchivedAction(id: string): Promise<ActionResult> {
  return post(`${BASE}/${id}/archive/`, "Archived.");
}

export async function markAllReadAction(): Promise<ActionResult> {
  return post(`${BASE}/read-all/`, "All caught up.");
}

async function post(path: string, success: string): Promise<ActionResult> {
  try {
    await djangoFetch(path, { method: "POST" });
    revalidatePath("/notifications");
    return { ok: true, message: success };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiRequestError ? error.message : "Something went wrong.",
    };
  }
}
