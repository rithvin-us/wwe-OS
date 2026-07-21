import { djangoFetch } from "@/lib/api/server";

export async function getTenantConfig() {
  return djangoFetch<{ config: Record<string, any> }>("/api/v1/tenancy/tenant/");
}

export async function getAIUsage() {
  return djangoFetch<{ totals: Record<string, any>; by_model: any[]; by_module: any[] }>(
    "/api/v1/ai/usage/",
  );
}
