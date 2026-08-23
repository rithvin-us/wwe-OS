"use client";

import { Archive, CheckCircle2, FileText, HardDrive, PieChart, Sparkles } from "@bop/icons";

import { ChartCard, DonutChartComponent } from "@/components/charts";
import { formatFileSize, type DocumentRecord } from "@/lib/dms-constants";

export function DMSStatTiles({ documents }: { documents: DocumentRecord[] }) {
  const total = documents.length;
  const active = documents.filter((d) => d.status === "active").length;
  const archived = documents.filter((d) => d.status === "archived").length;
  const summarized = documents.filter((d) => d.summary_status === "ready").length;

  const totalBytes = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const formattedStorage = formatFileSize(totalBytes);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total Documents & Storage */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
            Total Documents
          </span>
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {total}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <HardDrive className="h-3 w-3" /> {formattedStorage}
          </span>
        </div>
      </div>

      {/* Active Documents */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
            Active Files
          </span>
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {active}
          </span>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
            {total > 0 ? Math.round((active / total) * 100) : 0}% active
          </span>
        </div>
      </div>

      {/* AI Summarized */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
            AI Summarized
          </span>
          <Sparkles className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {summarized}
          </span>
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {total > 0 ? Math.round((summarized / total) * 100) : 0}% processed
          </span>
        </div>
      </div>

      {/* Archived */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
            Archived
          </span>
          <Archive className="h-4 w-4 text-slate-500" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {archived}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">Historical</span>
        </div>
      </div>
    </div>
  );
}

const SUMMARY_STATUS_LABEL: Record<string, string> = {
  ready: "Summarized",
  none: "Not yet processed",
  failed: "Failed",
};

const SUMMARY_STATUS_COLOR: Record<string, string> = {
  ready: "var(--chart-2)",
  none: "var(--chart-4)",
  failed: "var(--chart-5)",
};

export function DMSCharts({ documents }: { documents: DocumentRecord[] }) {
  const total = documents.length;

  // Share of stored documents by business category.
  const categoriesCount: Record<string, number> = {};
  documents.forEach((d) => {
    const cat = d.category_label || d.category;
    categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
  });

  // Share of storage bytes by business category — same buckets, weighted by
  // size instead of count, since a handful of large PDFs can dominate storage
  // while barely moving the file-count chart.
  const storageByCategory: Record<string, number> = {};
  documents.forEach((d) => {
    const cat = d.category_label || d.category;
    storageByCategory[cat] = (storageByCategory[cat] || 0) + (d.file_size || 0);
  });

  // AI processing coverage — how much of the library is actually searchable
  // by the Rithu RAG chatbot (ready), versus still pending or failed.
  const summaryStatusCount: Record<string, number> = { ready: 0, none: 0, failed: 0 };
  documents.forEach((d) => {
    summaryStatusCount[d.summary_status] = (summaryStatusCount[d.summary_status] || 0) + 1;
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard
        title="Document Distribution by Category"
        description="Share of stored documents across business modules"
        badge="DMS Storage"
        icon={PieChart}
      >
        <DonutChartComponent
          data={Object.entries(categoriesCount).map(([name, value], idx) => ({
            name,
            value,
            color: `var(--chart-${(idx % 5) + 1})`,
          }))}
          height={170}
          centerTitle="Files Stored"
          centerValue={`${total}`}
          valueFormatter={(v) => `${v} files`}
        />
      </ChartCard>

      <ChartCard
        title="Storage by Category"
        description="Which document types take up the most space"
        badge="DMS Storage"
        icon={HardDrive}
      >
        <DonutChartComponent
          data={Object.entries(storageByCategory)
            .filter(([, bytes]) => bytes > 0)
            .map(([name, bytes], idx) => ({
              name,
              value: bytes,
              color: `var(--chart-${(idx % 5) + 1})`,
            }))}
          height={170}
          centerTitle="Total Size"
          centerValue={formatFileSize(documents.reduce((acc, d) => acc + (d.file_size || 0), 0))}
          valueFormatter={(v) => formatFileSize(Number(v))}
        />
      </ChartCard>

      <ChartCard
        title="AI Processing Coverage"
        description="Documents ready for AI summaries and the Rithu chatbot's search index"
        badge="AI Insights"
        icon={Sparkles}
      >
        <DonutChartComponent
          data={Object.entries(summaryStatusCount)
            .filter(([, count]) => count > 0)
            .map(([status, value]) => ({
              name: SUMMARY_STATUS_LABEL[status] ?? status,
              value,
              color: SUMMARY_STATUS_COLOR[status],
            }))}
          height={170}
          centerTitle="Indexed"
          centerValue={`${summaryStatusCount.ready}/${total}`}
          valueFormatter={(v) => `${v} files`}
        />
      </ChartCard>
    </div>
  );
}
