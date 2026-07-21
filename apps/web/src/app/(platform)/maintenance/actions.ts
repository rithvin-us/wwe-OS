"use server";

import { djangoFetch } from "@/lib/api/server";

export async function updateTenantConfigAction(data: { config: Record<string, any> }) {
  return djangoFetch<unknown>("/api/v1/tenancy/tenant/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
