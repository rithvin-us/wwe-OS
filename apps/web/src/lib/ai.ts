import { djangoFetch } from "@/lib/api/server";

/** Runs the "dashboard-business-summary" prompt (platform/ai/prompts.py)
 * against today's real figures — never invents numbers, and cached
 * server-side for an hour so a busy dashboard doesn't re-trigger an AI call
 * on every visit. Returns null on any failure (missing provider, rate
 * limit, etc.) — the dashboard treats that as an honest empty state, not
 * an error. */
export async function getBusinessSummary(statsText: string): Promise<string | null> {
  try {
    const result = await djangoFetch<{ text: string }>("/api/v1/ai/generate/", {
      method: "POST",
      body: JSON.stringify({
        prompt_key: "dashboard-business-summary",
        variables: { stats: statsText },
        use_case: "dashboard-business-summary",
        cache_ttl: 3600,
      }),
    });
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}
