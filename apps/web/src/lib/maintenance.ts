import { djangoFetch, internalApiUrl } from "@/lib/api/server";

export async function getTenantConfig() {
  try {
    return await djangoFetch<{ config: Record<string, any> }>("/api/v1/tenancy/current/");
  } catch {
    return { config: {} };
  }
}

export async function getAIUsage() {
  try {
    return await djangoFetch<{ totals: Record<string, any>; by_model: any[]; by_module: any[] }>(
      "/api/v1/ai/usage/",
    );
  } catch {
    return { totals: { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 }, by_model: [], by_module: [] };
  }
}

export async function getBackendHealth() {
  try {
    const res = await fetch(`${internalApiUrl()}/healthz`, { cache: "no-store" });
    return { status: res.ok ? "healthy" : "unhealthy" };
  } catch {
    return { status: "unhealthy" };
  }
}
