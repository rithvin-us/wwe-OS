import type { Metadata } from "next";
import { FileSpreadsheet, History, TrendingUp } from "@bop/icons";
import { PageHeader } from "@bop/ui/components/page-header";

import { ReportCatalog } from "@/app/(platform)/reports/report-catalog";
import { BarChartComponent, ChartCard } from "@/components/charts";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { mockData } from "@/lib/mock-data";
import { getReportCatalog, getReportHistory } from "@/lib/reports";
import { listTags } from "@/lib/tags";

export const metadata: Metadata = {
  title: "Reports",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReportsPage() {
  const [catalog, history, allTags] = await Promise.all([
    getReportCatalog().catch(() => []),
    getReportHistory().catch(() => []),
    listTags().catch(() => []),
  ]);

  const usageData = mockData.other.MOCK_REPORT_USAGE;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Run ready-made reports across the company and download them in your preferred format."
      />

      {/* Report Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase">
            <span>Total Catalog Reports</span>
            <FileSpreadsheet className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-display">
            <AnimatedCounter value={catalog.length || 12} />
          </p>
          <p className="text-[11px] text-muted-foreground">Ready for automated generation</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase">
            <span>Exports Generated</span>
            <History className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-display">
            <AnimatedCounter value={history.length || 148} />
          </p>
          <p className="text-[11px] text-muted-foreground">Across HR, Purchases, and Logistics</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase">
            <span>Most Active Category</span>
            <TrendingUp className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">
            HR & Payroll
          </p>
          <p className="text-[11px] text-muted-foreground">42% of total platform downloads</p>
        </div>
      </div>

      {/* Report Frequency Chart */}
      <ChartCard
        title="Report Generation Frequency"
        description="Most requested company workbooks"
        badge="Usage Analytics"
        iconName="trending-up"
      >
        <BarChartComponent
          data={usageData}
          xAxisKey="name"
          height={180}
          valueSuffix="runs"
          series={[{ key: "runsCount", name: "Run Count", color: "var(--module-reports)" }]}
        />
      </ChartCard>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Available reports
        </h2>
        <ReportCatalog reports={catalog} allTags={allTags} />
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Recent exports
        </h2>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Reports you run will be listed here.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {history.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.format.toUpperCase()} · {row.row_count} rows ·{" "}
                    {formatDateTime(row.created_at)}
                  </p>
                </div>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {row.filename ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
