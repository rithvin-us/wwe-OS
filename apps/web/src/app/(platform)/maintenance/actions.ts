"use server";

import { djangoFetch } from "@/lib/api/server";

export async function updateTenantConfigAction(data: { config: Record<string, unknown> }) {
  try {
    const res = await djangoFetch<unknown>("/api/v1/tenancy/current/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { success: true, data: res };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update configuration",
    };
  }
}
