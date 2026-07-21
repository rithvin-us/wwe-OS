import { djangoFetch, internalApiUrl } from "@/lib/api/server";

export async function getTenantConfig() {
  return djangoFetch<{ config: Record<string, any> }>("/api/v1/tenancy/tenant/");
}

export async function getAIUsage() {
  return djangoFetch<{ totals: Record<string, any>; by_model: any[]; by_module: any[] }>(
    "/api/v1/ai/usage/",
  );
}

export async function getBackendHealth() {
  try {
    const res = await fetch(`${internalApiUrl()}/healthz`, { cache: "no-store" });
    return { status: res.ok ? "healthy" : "unhealthy" };
  } catch (e) {
    return { status: "unhealthy" };
  }
}
