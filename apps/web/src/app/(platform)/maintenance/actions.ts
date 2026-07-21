"use server";

import { djangoFetch } from "@/lib/api/server";

export async function updateTenantConfigAction(data: { config: Record<string, any> }) {
  try {
    const res = await djangoFetch<unknown>("/api/v1/tenancy/current/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { success: true, data: res };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update configuration",
    };
  }
}
