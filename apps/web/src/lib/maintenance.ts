import { djangoFetch, internalApiUrl } from "@/lib/api/server";

export interface TenantConfig {
  openai_api_key?: string;
  [key: string]: unknown;
}

export interface AIUsageTotals {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AIUsageByModule {
  module: string;
  calls: number;
  cost_usd: number;
}

export async function getTenantConfig(): Promise<{ config: TenantConfig }> {
  try {
    return await djangoFetch<{ config: TenantConfig }>("/api/v1/tenancy/current/");
  } catch {
    return { config: {} };
  }
}

export async function getAIUsage(): Promise<{
  totals: AIUsageTotals;
  by_model: unknown[];
  by_module: AIUsageByModule[];
}> {
  try {
    return await djangoFetch<{
      totals: AIUsageTotals;
      by_model: unknown[];
      by_module: AIUsageByModule[];
    }>("/api/v1/ai/usage/");
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
