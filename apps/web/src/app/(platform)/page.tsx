import { Activity, CircleDollarSign, ShoppingCart, Sparkles, TriangleAlert } from "@bop/icons";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { AlertRow } from "@/components/dashboard/alert-row";
import { Greeting } from "@/components/dashboard/greeting";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { QuickActions } from "@/components/dashboard/quick-actions";
import {
  PanelEmpty,
  SectionCard,
  SectionCardSkeleton,
  SummaryRows,
} from "@/components/dashboard/section-card";
import {
  buildKpis,
  FINANCIAL_SUMMARY,
  operationalAlerts,
  procurementSummary,
  recentActivity,
  type LivePurchaseStats,
} from "@/config/dashboard";
import { getBusinessSummary } from "@/lib/ai";
import { activityLabel, getTodayActivity } from "@/lib/audit";
import { getActiveRules } from "@/lib/automation";
import { getContracts } from "@/lib/contracts";
import { getPurchaseBillStats, getRecentTelegramBills } from "@/lib/purchase";

export const metadata: Metadata = {
  title: "Dashboard",
};

const CONTRACT_EXPIRY_WINDOW_DAYS = 30;
const TELEGRAM_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadPurchaseStats(): Promise<LivePurchaseStats | null> {
  try {
    const stats = await getPurchaseBillStats();
    return {
      processed: stats.processed,
      needsAttention: stats.needs_attention,
      total: stats.total,
      unpaid: stats.unpaid,
    };
  } catch {
    return null;
  }
}

async function loadTelegramCount(): Promise<number | null> {
  try {
    const bills = await getRecentTelegramBills();
    const cutoff = Date.now() - TELEGRAM_WINDOW_DAYS * DAY_MS;
    return bills.filter((bill) => new Date(bill.created_at).getTime() >= cutoff).length;
  } catch {
    return null;
  }
}

async function loadAutomationDueCount(): Promise<number> {
  try {
    const rules = await getActiveRules();
    const now = Date.now();
    return rules.filter((rule) => rule.next_run_at && new Date(rule.next_run_at).getTime() <= now)
      .length;
  } catch {
    return 0;
  }
}

async function loadContractsExpiringCount(): Promise<number> {
  try {
    const contracts = await getContracts({ status: "active" });
    const cutoff = Date.now() + CONTRACT_EXPIRY_WINDOW_DAYS * DAY_MS;
    return contracts.filter(
      (contract) => contract.end_date && new Date(contract.end_date).getTime() <= cutoff,
    ).length;
  } catch {
    return 0;
  }
}

function buildStatsText(args: {
  purchase: LivePurchaseStats | null;
  activityCount: number;
  automationDueCount: number;
  contractsExpiringCount: number;
}): string {
  const lines: string[] = [];
  if (args.purchase) {
    lines.push(
      `Purchases: ${args.purchase.processed} processed, ${args.purchase.needsAttention} need ` +
        `attention, ${args.purchase.unpaid} unpaid.`,
    );
  }
  lines.push(
    `${args.activityCount} activity event${args.activityCount === 1 ? "" : "s"} recorded today.`,
  );
  if (args.contractsExpiringCount > 0) {
    lines.push(`${args.contractsExpiringCount} contract(s) expiring within 30 days.`);
  }
  if (args.automationDueCount > 0) {
    lines.push(`${args.automationDueCount} automation rule(s) due to run.`);
  }
  return lines.join("\n");
}

export default async function DashboardPage() {
  const [
    purchaseStats,
    telegramCount,
    automationDueCount,
    contractsExpiringCount,
    activityEntries,
  ] = await Promise.all([
    loadPurchaseStats(),
    loadTelegramCount(),
    loadAutomationDueCount(),
    loadContractsExpiringCount(),
    getTodayActivity(8),
  ]);

  const kpis = buildKpis(purchaseStats);
  const alerts = operationalAlerts(purchaseStats, automationDueCount, contractsExpiringCount);
  const activity = recentActivity(activityEntries, activityLabel);

  // Skip the AI call entirely on a quiet/fresh install — nothing real to
  // summarize, and no reason to spend a call describing emptiness.
  const hasSignal = purchaseStats !== null || activityEntries.length > 0;
  // Deliberately not awaited — the AI round-trip (slow on a cold cache) is
  // isolated behind its own <Suspense> boundary below so it never blocks
  // the rest of the dashboard's first paint.
  const summaryPromise = hasSignal
    ? getBusinessSummary(
        buildStatsText({
          purchase: purchaseStats,
          activityCount: activityEntries.length,
          automationDueCount,
          contractsExpiringCount,
        }),
      )
    : Promise.resolve(null);

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Greeting />
        <QuickActions />
      </div>

      {/* Operational pulse */}
      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.key} kpi={kpi} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Primary column */}
        <div className="space-y-4 lg:col-span-8">
          <SectionCard title="Financial summary" icon={CircleDollarSign} href="/reports">
            <SummaryRows rows={FINANCIAL_SUMMARY} />
          </SectionCard>

          <SectionCard title="Procurement & bills" icon={ShoppingCart} href="/purchase">
            <SummaryRows rows={procurementSummary(purchaseStats, telegramCount)} />
          </SectionCard>

          <SectionCard title="Recent activity" icon={Activity} href="/timeline">
            {activity.length === 0 ? (
              <PanelEmpty>
                Activity from across the company will appear here as your team gets to work.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-foreground">{item.summary}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {item.at}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Attention column */}
        <div className="space-y-4 lg:col-span-4">
          <SectionCard title="Operational alerts" icon={TriangleAlert}>
            {alerts.length === 0 ? (
              <PanelEmpty>
                All clear. Overdue bills and pending reviews are flagged here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-1">
                {alerts.map((item) => (
                  <AlertRow key={item.id} alert={item} />
                ))}
              </ul>
            )}
          </SectionCard>

          <Suspense fallback={<SectionCardSkeleton title="AI insights" icon={Sparkles} rows={2} />}>
            <AiInsightsPanel summaryPromise={summaryPromise} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
