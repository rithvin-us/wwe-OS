import { getActiveRules } from "@/lib/automation";
import { getPurchaseBillStats } from "@/lib/purchase";

/**
 * BFF for sidebar/command-palette badge counts — the sidebar is a client
 * component and can't call the server-only djangoFetch directly. Only
 * covers areas with a genuinely wired count today; anything without a real
 * backend number is left out rather than guessed at.
 */
export async function GET(): Promise<Response> {
  const [purchaseStats, rules] = await Promise.all([
    getPurchaseBillStats().catch(() => null),
    getActiveRules().catch(() => []),
  ]);

  const now = Date.now();
  const automationDue = rules.filter(
    (rule) => rule.next_run_at && new Date(rule.next_run_at).getTime() <= now,
  ).length;

  return Response.json({
    purchase: purchaseStats?.needs_attention ?? 0,
    automation: automationDue,
  });
}
