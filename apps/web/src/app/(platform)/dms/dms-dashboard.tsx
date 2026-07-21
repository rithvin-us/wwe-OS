import { FileText, Sparkles, HardDrive, CheckCircle2, Archive } from "@bop/icons";
import { formatFileSize, type DocumentRecord } from "@/lib/dms-constants";

export function DMSDashboard({ documents }: { documents: DocumentRecord[] }) {
  const total = documents.length;
  const active = documents.filter((d) => d.status === "active").length;
  const archived = documents.filter((d) => d.status === "archived").length;
  const summarized = documents.filter((d) => d.summary_status === "ready").length;

  const totalBytes = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const formattedStorage = formatFileSize(totalBytes);

  // Group by category for distribution
  const categoriesCount: Record<string, number> = {};
  documents.forEach((d) => {
    const cat = d.category_label || d.category;
    categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
  });

  const categoryColors: Record<string, string> = {
    Contract: "bg-indigo-500 text-indigo-600 dark:text-indigo-400",
    Invoice: "bg-emerald-500 text-emerald-600 dark:text-emerald-400",
    Policy: "bg-amber-500 text-amber-600 dark:text-amber-400",
    Report: "bg-blue-500 text-blue-600 dark:text-blue-400",
    Correspondence: "bg-purple-500 text-purple-600 dark:text-purple-400",
    Other: "bg-slate-500 text-slate-600 dark:text-slate-400",
  };

  return (
    <div className="space-y-4">
      {/* 4 Insight Stat Tiles */}
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
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {active}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
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

      {/* Category Proportional Distribution Bar */}
      {total > 0 && Object.keys(categoriesCount).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Category Distribution</span>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              {Object.entries(categoriesCount).map(([cat, count]) => {
                const colorClass = categoryColors[cat] || "bg-slate-500 text-slate-600";
                const dotColor = colorClass.split(" ")[0];
                const textColor = colorClass.split(" ").slice(1).join(" ");
                return (
                  <span key={cat} className={`flex items-center gap-1.5 ${textColor}`}>
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    {cat} ({count})
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
            {Object.entries(categoriesCount).map(([cat, count]) => {
              const pct = (count / total) * 100;
              const colorClass = categoryColors[cat] || "bg-slate-500";
              const bgColor = colorClass.split(" ")[0];
              return (
                <div
                  key={cat}
                  className={`${bgColor} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
