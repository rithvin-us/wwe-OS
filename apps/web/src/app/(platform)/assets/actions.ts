"use server";

import { djangoFetch } from "@/lib/api/server";
import { ApiRequestError } from "@/lib/api/envelope";

export async function generateDCAction(data: {
  dc_number: string;
  dc_type: string;
  site_id: string;
  date: string;
  items: { id: string; qty: number }[];
}) {
  try {
    const res = await djangoFetch<unknown>("/api/v1/assets/dcs/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: true, res };
  } catch (err: any) {
    if (err instanceof ApiRequestError) {
      return {
        success: false,
        error: err.message,
        details: err.details,
      };
    }
    return {
      success: false,
      error: err.message || "Failed to generate DC",
    };
  }
}
