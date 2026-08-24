import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate } from "@bop/icons";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import { BarChartComponent, ChartCard } from "@/components/charts";
import { automationRunSeries } from "@/config/automation";
import { getAlertRules } from "@/lib/alerts";
import { getRules, getRuleSources, getRunHistory } from "@/lib/automation";
import { getBillingCustomers, getInvoices, getNextInvoiceNumber } from "@/lib/invoices";
import { getReportCatalog } from "@/lib/reports";
import { listTags } from "@/lib/tags";

import { AlertRulesTable } from "@/app/(platform)/automation/alert-rules-table";
import { InvoiceGeneration } from "@/app/(platform)/automation/invoice-generation";
import { RulesTable } from "@/app/(platform)/automation/rules-table";

export const metadata: Metadata = {
  title: "Automation",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AutomationPage() {
  const [rules, sources, history, reports, allTags, customers, invoices, nextNumber, alertRules] =
    await Promise.all([
      getRules().catch(() => []),
      getRuleSources().catch(() => []),
      getRunHistory().catch(() => []),
      getReportCatalog().catch(() => []),
      listTags().catch(() => []),
      getBillingCustomers(),
      getInvoices(),
      getNextInvoiceNumber(),
      getAlertRules(),
    ]);

  const automationRuns = automationRunSeries(history);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Automation"
        description="Collect tagged records on a schedule — a downloaded package, a generated report, or an auditor folder. Nothing is ever collected untagged, and nothing is ever emailed or uploaded automatically yet."
      />

      {/* Rule Execution Health Chart */}
      <ChartCard
        title="Automation Execution Health"
        empty={history.length === 0}
        description="Scheduled rule triggers and collection runs, last 7 days"
        badge="Weekly Execution"
        iconName="zap"
      >
        <BarChartComponent
          data={automationRuns}
          xAxisKey="day"
          height={170}
          valueSuffix="runs"
          series={[
            { key: "successful", name: "Successful", color: "var(--module-automation)" },
            { key: "failed", name: "Failed", color: "var(--destructive)" },
          ]}
        />
      </ChartCard>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Documents
        </h2>
        <InvoiceGeneration
          customers={customers}
          nextNumber={nextNumber}
          recent={invoices.slice(0, 3)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Rules
        </h2>
        <RulesTable rules={rules} sources={sources} reports={reports} allTags={allTags} />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Alerts
        </h2>
        <AlertRulesTable rules={alertRules} />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Recent runs
        </h2>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Runs — scheduled or manual — will be listed here, with exactly what each one collected.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {history.map((run) => (
              <Link
                key={run.id}
                href={`/automation/runs/${run.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{run.rule_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.item_count} item{run.item_count === 1 ? "" : "s"} ·{" "}
                    {run.triggered_by === "manual" ? "Manual" : "Scheduled"} ·{" "}
                    {formatDateTime(run.created_at)}
                  </p>
                </div>
                <span
                  className={
                    run.status === "success"
                      ? "shrink-0 text-xs font-medium text-success"
                      : "shrink-0 text-xs font-medium text-destructive"
                  }
                >
                  {run.status === "success" ? "Success" : "Failed"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Templates
        </h2>
        <EmptyState
          icon={LayoutTemplate}
          title="Coming soon"
          description="Ready-made rule templates for common handoffs (monthly auditor bundle, vendor statement pack) will appear here."
        />
      </section>
    </div>
  );
}
