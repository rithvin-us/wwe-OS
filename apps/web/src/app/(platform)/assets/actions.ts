"use server";

import { revalidatePath } from "next/cache";
import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch, getAccessToken, internalApiUrl } from "@/lib/api/server";
import type { AssetCreateInput } from "@/lib/assets-constants";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const BASE = "/api/v1/assets/assets";

export async function createAssetAction(input: AssetCreateInput): Promise<ActionResult> {
  try {
    const asset = await djangoFetch<{ id: string }>(`${BASE}/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/assets");
    return { ok: true, message: "Asset added.", id: asset.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function assignAssetAction(id: string, assignedTo: string): Promise<ActionResult> {
  return postJson(`${BASE}/${id}/assign/`, { assigned_to: assignedTo }, "Asset assigned.", id);
}

export async function returnAssetAction(id: string): Promise<ActionResult> {
  return postJson(`${BASE}/${id}/return/`, {}, "Asset returned to stock.", id);
}

export async function startMaintenanceAction(id: string): Promise<ActionResult> {
  return postJson(`${BASE}/${id}/maintenance/start/`, {}, "Sent to maintenance.", id);
}

export async function completeMaintenanceAction(
  id: string,
  input: { description: string; cost: string | null; vendor: string },
): Promise<ActionResult> {
  return postJson(`${BASE}/${id}/maintenance/complete/`, input, "Maintenance recorded.", id);
}

export async function disposeAssetAction(
  id: string,
  input: { reason: string; proceeds: string | null },
): Promise<ActionResult> {
  return postJson(`${BASE}/${id}/dispose/`, input, "Asset disposed.", id);
}

export async function deleteAssetAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/assets");
    return { ok: true, message: "Asset deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

/** Multipart: attaching a warranty/invoice file goes out as form-data. */
export async function attachAssetFileAction(id: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to attach." };
  }
  try {
    const token = await getAccessToken();
    const forward = new FormData();
    forward.append("file", file);
    const response = await fetch(`${internalApiUrl()}${BASE}/${id}/attach/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: forward,
      cache: "no-store",
    });
    const envelope = await response.json();
    if (!envelope.success) {
      return { ok: false, message: envelope.error?.message ?? "Attach failed." };
    }
    revalidatePath(`/assets/${id}`);
    return { ok: true, message: "File attached." };
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  success: string,
  id: string,
): Promise<ActionResult> {
  try {
    await djangoFetch(path, { method: "POST", body: JSON.stringify(body) });
    revalidatePath("/assets");
    revalidatePath(`/assets/${id}`);
    return { ok: true, message: success };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

export async function generateDCAction(data: {
  dc_number: string;
  dc_type: string;
  site_id: string;
  date: string;
  deliver_to?: string;
  items: { id: string; qty: number; unit?: string }[];
}) {
  try {
    const res = await djangoFetch<unknown>("/api/v1/assets/dcs/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: true, res };
  } catch (err: unknown) {
    if (err instanceof ApiRequestError) {
      return {
        success: false,
        error: err.message,
        details: err.details,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate DC",
    };
  }
}

export async function deleteDCAction(id: string) {
  try {
    await djangoFetch<unknown>(`/api/v1/assets/dcs/${id}/`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (err: unknown) {
    if (err instanceof ApiRequestError) {
      return {
        success: false,
        error: err.message,
        details: err.details,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete DC",
    };
  }
}
