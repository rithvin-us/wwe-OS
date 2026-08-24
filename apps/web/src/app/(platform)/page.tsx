import { Activity, CircleDollarSign, ShoppingCart, TriangleAlert } from "@bop/icons";
import type { Metadata } from "next";

import { AlertRow } from "@/components/dashboard/alert-row";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { Greeting } from "@/components/dashboard/greeting";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PanelEmpty, SectionCard, SummaryRows } from "@/components/dashboard/section-card";
import { PullToRefresh } from "@/components/pull-to-refresh";
import {
  type AttendanceTrendPoint,
  attendanceTrend,
  buildKpis,
  categoryBreakdown,
  currentPeriod,
  financialSummary,
  financialTrend,
  type LiveFinancials,
  type LivePurchaseStats,
  monthlyAmountFor,
  operationalAlerts,
  procurementSummary,
  recentActivity,
  spendTrend,
} from "@/config/dashboard";
import { activityLabel, getTodayActivity } from "@/lib/audit";
import { getActiveRules } from "@/lib/automation";
import { getContracts } from "@/lib/contracts";
import { getAttendanceTrends } from "@/lib/hr";
import { getInvoiceStats } from "@/lib/invoices";
import { getPurchaseBillStats, getPurchaseInsights, getRecentTelegramBills } from "@/lib/purchase";

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

async function loadAttendanceTrend(): Promise<AttendanceTrendPoint[] | null> {
  try {
    const now = new Date();
    const { points } = await getAttendanceTrends(now.getFullYear(), now.getMonth() + 1, 6);
    return points;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [
    purchaseStats,
    purchaseInsights,
    invoiceStats,
    attendanceTrendPoints,
    telegramCount,
    automationDueCount,
    contractsExpiringCount,
    activityEntries,
  ] = await Promise.all([
    loadPurchaseStats(),
    getPurchaseInsights(),
    getInvoiceStats(),
    loadAttendanceTrend(),
    loadTelegramCount(),
    loadAutomationDueCount(),
    loadContractsExpiringCount(),
    getTodayActivity(8),
  ]);

  const financials: LiveFinancials = {
    revenueMonth: invoiceStats ? invoiceStats.revenue_month : null,
    // Expenses share the purchase API's fate — if its stats fetch failed,
    // report the failure honestly rather than a live-looking 0.
    expensesMonth:
      purchaseStats === null
        ? null
        : monthlyAmountFor(purchaseInsights.monthly_spend, currentPeriod()),
  };
  const outstanding = invoiceStats ? invoiceStats.outstanding : null;
  const revenueVsExpenses = financialTrend(
    invoiceStats?.monthly ?? null,
    purchaseInsights.monthly_spend,
  );
  const spend = spendTrend(purchaseInsights.monthly_spend);
  const attendance = attendanceTrend(attendanceTrendPoints);
  const categories = categoryBreakdown(purchaseInsights.top_materials);

  const dataAsOf = new Date().toISOString();
  const kpis = buildKpis(purchaseStats, financials);
  const alerts = operationalAlerts(purchaseStats, automationDueCount, contractsExpiringCount);
  const hasUrgentAlert = alerts.some((item) => item.severity !== "info");
  const activity = recentActivity(activityEntries, activityLabel);

  return (
    <PullToRefresh>
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

        {/* Visual insight charts — all real data: revenue vs expenses and
            spend from invoices + purchases, attendance from HR, and spend by
            top purchased item. Each renders an honest empty state when its
            source has no data yet. */}
        <DashboardCharts
          financialTrend={revenueVsExpenses}
          spendTrend={spend}
          attendanceTrend={attendance}
          categoryBreakdown={categories}
        />

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Primary column */}
          <div className="space-y-4 lg:col-span-8">
            <SectionCard title="Financial summary" icon={CircleDollarSign} href="/reports" glass>
              <SummaryRows rows={financialSummary(financials, outstanding)} />
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
    </PullToRefresh>
  );
}
