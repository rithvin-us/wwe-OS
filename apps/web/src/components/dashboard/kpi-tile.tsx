import { ArrowDownRight, ArrowUpRight } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { formatValue, type Kpi } from "@/config/dashboard";

/**
 * A single company KPI. Shows the live figure, its period change, and where
 * it comes from. When a figure isn't available yet it reads "—" with a quiet
 * note — never a placeholder number.
 *
 * Only wired KPIs (kpi.href set) are real links — an unwired metric has
 * nowhere honest to send the operator, so it stays a plain, non-interactive
 * tile rather than a dead click target.
 *
 * No mount animation of its own: the KPI grid resolves in lockstep with the
 * rest of the dashboard, and the route-level crossfade in app-shell.tsx
 * already confirms "this content just arrived" once, at the page level. A
 * second, per-tile staggered entrance on top of that was decorative
 * repetition, not a second real event worth confirming.
 */
export function KpiTile({ kpi }: { kpi: Kpi }) {
  const display = formatValue(kpi.value, kpi.format);
  const hasValue = kpi.value !== null;
  const up = (kpi.deltaPct ?? 0) >= 0;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
          {kpi.label}
        </span>
        <kpi.icon aria-hidden className="size-4 text-muted-foreground-subtle" />
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            "font-display text-2xl font-semibold tracking-tight tabular-nums",
            hasValue ? "text-foreground" : "text-muted-foreground-subtle",
          )}
        >
          {display}
        </span>
        {kpi.deltaPct !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              // Semantic success/attention, not the module-status palette —
              // a KPI trending up or down is a different kind of "state"
              // than a module being operational or needing attention.
              up ? "text-success" : "text-destructive",
            )}
          >
            {up ? (
              <ArrowUpRight aria-hidden className="size-3.5" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3.5" />
            )}
            {Math.abs(kpi.deltaPct)}%
          </span>
        ) : null}
      </div>

      <span className="text-[11px] text-muted-foreground-subtle">
        {hasValue ? kpi.source : `Awaiting first data · ${kpi.source}`}
      </span>
    </>
  );

  if (kpi.href) {
    return (
      <Link
        href={kpi.href}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-shadow duration-(--duration-base) hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">{content}</div>
  );
}
