import {
  Activity,
  Boxes,
  CircleDollarSign,
  FileSignature,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  Users,
} from "@bop/icons";
import type { Metadata } from "next";
import Link from "next/link";

import { Greeting } from "@/components/dashboard/greeting";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PanelEmpty, SectionCard, SummaryRows } from "@/components/dashboard/section-card";
import {
  AI_INSIGHTS,
  buildKpis,
  CONTRACTS_SUMMARY,
  FINANCIAL_SUMMARY,
  INVENTORY_SUMMARY,
  operationalAlerts,
  pendingApprovals,
  PEOPLE_SUMMARY,
  procurementSummary,
  recentActivity,
  type LivePurchaseStats,
} from "@/config/dashboard";
import { getPurchaseBills, getPurchaseBillStats, getRecentPurchaseActivity } from "@/lib/purchase";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function loadPurchaseData() {
  try {
    const [stats, pending, recent] = await Promise.all([
      getPurchaseBillStats(),
      getPurchaseBills({ status: "pending_review" }),
      getRecentPurchaseActivity(),
    ]);
    const live: LivePurchaseStats = {
      pendingReview: stats.pending_review,
      confirmed: stats.confirmed,
      rejected: stats.rejected,
      total: stats.total,
      unpaidConfirmed: stats.unpaid_confirmed,
      overduePending: stats.overdue_pending,
    };
    return { stats: live, pending, recent };
  } catch {
    // The dashboard must never go down because one module's API did —
    // every panel it feeds renders its honest, un-fetched empty state.
    return { stats: null, pending: [], recent: [] };
  }
}

export default async function DashboardPage() {
  const { stats: purchaseStats, pending, recent } = await loadPurchaseData();
  const kpis = buildKpis(purchaseStats);
  const approvals = pendingApprovals(pending);
  const alerts = operationalAlerts(purchaseStats);
  const activity = recentActivity(recent);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Greeting />
        <QuickActions />
      </div>

      {/* Company pulse */}
      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi, index) => (
            <KpiTile key={kpi.key} kpi={kpi} index={index} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Primary column */}
        <div className="space-y-4 lg:col-span-8">
          <SectionCard title="Financial summary" icon={CircleDollarSign} href="/reports">
            <SummaryRows rows={FINANCIAL_SUMMARY} />
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Procurement" icon={ShoppingCart} href="/purchase">
              <SummaryRows rows={procurementSummary(purchaseStats)} />
            </SectionCard>
            <SectionCard title="Inventory" icon={Boxes} href="/inventory">
              <SummaryRows rows={INVENTORY_SUMMARY} />
            </SectionCard>
            <SectionCard title="People" icon={Users} href="/hr">
              <SummaryRows rows={PEOPLE_SUMMARY} />
            </SectionCard>
            <SectionCard title="Contracts" icon={FileSignature} href="/contracts">
              <SummaryRows rows={CONTRACTS_SUMMARY} />
            </SectionCard>
          </div>

          <SectionCard title="Recent activity" icon={Activity}>
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
          <SectionCard title="Pending approvals" icon={FileSignature}>
            {approvals.length === 0 ? (
              <PanelEmpty>
                No approvals waiting on you. Requests that need a decision show up here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {approvals.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="block space-y-0.5 rounded-md -mx-1.5 px-1.5 py-1 transition-colors hover:bg-accent/60"
                    >
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.area} · {item.requestedBy}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Operational alerts" icon={TriangleAlert}>
            {alerts.length === 0 ? (
              <PanelEmpty>
                All clear. Low stock, overdue items, and expiring contracts are flagged here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {alerts.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="text-foreground">{item.message}</span>
                    <span className="ml-1 text-xs text-muted-foreground">— {item.area}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="AI insights" icon={Sparkles}>
            {AI_INSIGHTS.length === 0 ? (
              <PanelEmpty>
                Once there&rsquo;s activity to learn from, you&rsquo;ll see trends and suggestions
                here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {AI_INSIGHTS.map((item) => (
                  <li key={item.id} className="text-sm text-foreground">
                    {item.text}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
