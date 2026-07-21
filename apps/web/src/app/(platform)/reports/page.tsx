import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { ReportCatalog } from "@/app/(platform)/reports/report-catalog";
import { getReportCatalog, getReportHistory } from "@/lib/reports";

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
  const [catalog, history] = await Promise.all([getReportCatalog(), getReportHistory()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Run ready-made reports across the company and download them in your preferred format."
      />

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Available reports
        </h2>
        <ReportCatalog reports={catalog} />
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
