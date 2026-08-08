import { Activity, CircleDollarSign, ShoppingCart, TriangleAlert } from "@bop/icons";
import type { Metadata } from "next";

import { AlertRow } from "@/components/dashboard/alert-row";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { Greeting } from "@/components/dashboard/greeting";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PanelEmpty, SectionCard, SummaryRows } from "@/components/dashboard/section-card";
import {
  buildKpis,
  FINANCIAL_SUMMARY,
  operationalAlerts,
  procurementSummary,
  recentActivity,
  type LivePurchaseStats,
} from "@/config/dashboard";
import { activityLabel, getTodayActivity } from "@/lib/audit";
import { getActiveRules } from "@/lib/automation";
import { getContracts } from "@/lib/contracts";
import { getPurchaseBillStats, getRecentTelegramBills } from "@/lib/purchase";
import { mockData } from "@/lib/mock-data";

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

  const dataAsOf = new Date().toISOString();
  const kpis = buildKpis(purchaseStats);
  const alerts = operationalAlerts(purchaseStats, automationDueCount, contractsExpiringCount);
  const hasUrgentAlert = alerts.some((item) => item.severity !== "info");
  const activity = recentActivity(activityEntries, activityLabel);

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Greeting dataAsOf={dataAsOf} />
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

      {/* Visual insight charts */}
      <DashboardCharts
        financialTrend={mockData.dashboard.MOCK_FINANCIAL_TREND}
        spendTrend={mockData.dashboard.MOCK_SPEND_TREND}
        attendanceTrend={mockData.dashboard.MOCK_ATTENDANCE_TREND}
        categoryBreakdown={mockData.dashboard.MOCK_CATEGORY_BREAKDOWN}
        processFunnel={mockData.dashboard.MOCK_PROCESS_FUNNEL}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Primary column */}
        <div className="space-y-4 lg:col-span-8">
          <SectionCard title="Financial summary" icon={CircleDollarSign} href="/reports" glass>
            <SummaryRows rows={FINANCIAL_SUMMARY} />
          </SectionCard>

          <SectionCard title="Procurement & bills" icon={ShoppingCart} href="/purchase" glass>
            <SummaryRows rows={procurementSummary(purchaseStats, telegramCount)} />
          </SectionCard>

          <SectionCard title="Recent activity" icon={Activity} href="/timeline" glass>
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

        {/* Right sidebar column */}
        <div className="space-y-4 lg:col-span-4">
          {/* Monthly Operations Workflow — vertical stepper */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Monthly Workflow
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                Jul 2026
              </span>
            </div>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                    1
                  </span>
                  <span className="w-px flex-1 bg-border my-1" />
                </div>
                <div className="flex-1 pb-3">
                  <h3 className="text-xs font-semibold">Attendance Grid</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Fill presence, leave codes, and swipe times.
                  </p>
                  <a
                    href="/hr/attendance"
                    className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-md bg-muted text-[11px] font-medium hover:bg-accent transition-colors"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Open grid
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30">
                    2
                  </span>
                  <span className="w-px flex-1 bg-border my-1" />
                </div>
                <div className="flex-1 pb-3">
                  <h3 className="text-xs font-semibold">Payroll Execution</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Compute wages, OT, PF, and ESI from attendance.
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <span className="size-1.5 rounded-full bg-amber-500" /> Pending
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30">
                    3
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold">Generate Registers</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Produce 10 statutory workbooks, hash-archived.
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <span className="size-1.5 rounded-full bg-amber-500" /> Pending
                  </span>
                </div>
              </div>
            </div>
          </section>

          <SectionCard
            title="Operational alerts"
            icon={TriangleAlert}
            tone={hasUrgentAlert ? "warning" : "default"}
          >
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
        </div>
      </div>
    </div>
  );
}
