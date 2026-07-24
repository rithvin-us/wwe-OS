"use server";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

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
