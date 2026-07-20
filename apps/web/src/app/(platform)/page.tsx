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

import { Greeting } from "@/components/dashboard/greeting";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { PanelEmpty, SectionCard, SummaryRows } from "@/components/dashboard/section-card";
import {
  AI_INSIGHTS,
  CONTRACTS_SUMMARY,
  FINANCIAL_SUMMARY,
  INVENTORY_SUMMARY,
  KPIS,
  OPERATIONAL_ALERTS,
  PENDING_APPROVALS,
  PEOPLE_SUMMARY,
  PROCUREMENT_SUMMARY,
  RECENT_ACTIVITY,
} from "@/config/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Executive dashboard — the company command center. Answers one question:
 * "how is my company doing today?" It aggregates every business area into a
 * single overview. Figures are live where available and honestly blank where
 * an area hasn't been used yet — never invented. Business areas themselves
 * live in the sidebar; this page is for running the company, not managing it.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Greeting />
        <QuickActions />
      </div>

      {/* Company pulse */}
      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {KPIS.map((kpi) => (
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

          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard title="Procurement" icon={ShoppingCart} href="/purchase">
              <SummaryRows rows={PROCUREMENT_SUMMARY} />
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
            {RECENT_ACTIVITY.length === 0 ? (
              <PanelEmpty>
                Activity from across the company will appear here as your team gets to work.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {RECENT_ACTIVITY.map((item) => (
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
            {PENDING_APPROVALS.length === 0 ? (
              <PanelEmpty>
                No approvals waiting on you. Requests that need a decision show up here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {PENDING_APPROVALS.map((item) => (
                  <li key={item.id} className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.area} · {item.requestedBy}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Operational alerts" icon={TriangleAlert}>
            {OPERATIONAL_ALERTS.length === 0 ? (
              <PanelEmpty>
                All clear. Low stock, overdue items, and expiring contracts are flagged here.
              </PanelEmpty>
            ) : (
              <ul className="space-y-3">
                {OPERATIONAL_ALERTS.map((item) => (
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
