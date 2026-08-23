import { FileText, RotateCcw, Send, Calendar } from "@bop/icons";

export function DCAnalytics({
  dcs,
}: {
  dcs: {
    id: string;
    dc_number: string;
    dc_type: string;
    created_at: string;
  }[];
}) {
  const total = dcs.length;
  const returnable = dcs.filter((d) => d.dc_type === "returnable").length;
  const nonReturnable = dcs.filter((d) => d.dc_type === "non_returnable").length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonth = dcs.filter((d) => {
    const dt = new Date(d.created_at);
    return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
  }).length;

  const returnablePct = total > 0 ? Math.round((returnable / total) * 100) : 0;
  const nonReturnablePct = total > 0 ? Math.round((nonReturnable / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Total DCs */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Total Challans
            </span>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {total}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">All time</span>
          </div>
        </div>

        {/* Returnable */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Returnable
            </span>
            <RotateCcw className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {returnable}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {returnablePct}%
            </span>
          </div>
        </div>

        {/* Non-Returnable */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Non-Returnable
            </span>
            <Send className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {nonReturnable}
            </span>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
              {nonReturnablePct}%
            </span>
          </div>
        </div>

        {/* This Month */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Issued This Month
            </span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {thisMonth}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Recent</span>
          </div>
        </div>
      </div>

      {/* Distribution Ratio Bar */}
      {total > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Type Breakdown</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Returnable ({returnable})
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Non-Returnable ({nonReturnable})
              </span>
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="bg-emerald-500 transition-[width] duration-(--duration-slow) ease-out-quart"
              style={{ width: `${returnablePct}%` }}
            />
            <div
              className="bg-blue-500 transition-[width] duration-(--duration-slow) ease-out-quart"
              style={{ width: `${nonReturnablePct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
