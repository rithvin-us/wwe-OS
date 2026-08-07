import { ArrowDownRight, ArrowUpRight } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatValue, type Kpi } from "@/config/dashboard";

/**
 * A single company KPI. Shows the live figure, its period change, and where
 * it comes from.
 */
function KpiSparkline({ up }: { up: boolean }) {
  const points = up
    ? "0,22 15,18 30,20 45,12 60,14 75,6 90,8 105,3 120,5"
    : "0,5 15,8 30,12 45,10 60,18 75,15 90,22 105,20 120,25";
  const strokeColor = up ? "oklch(0.68 0.15 160)" : "oklch(0.65 0.18 25)";

  return (
    <svg
      className="h-6 w-20 shrink-0 overflow-visible opacity-70 transition-opacity group-hover:opacity-100"
      viewBox="0 0 120 28"
      fill="none"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const display = formatValue(kpi.value, kpi.format);
  const hasValue = kpi.value !== null;
  const isError = kpi.status === "error";
  const up = (kpi.deltaPct ?? 0) >= 0;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          {kpi.label}
        </span>
        <div className="flex items-center gap-2">
          <KpiSparkline up={up} />
          <kpi.icon
            aria-hidden
            className={cn("size-4 shrink-0", isError ? "text-warning" : "text-muted-foreground")}
          />
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            "font-display text-2xl font-bold tracking-tight tabular-nums",
            hasValue
              ? "text-foreground"
              : isError
                ? "text-warning"
                : "text-muted-foreground-subtle",
          )}
        >
          {hasValue && typeof kpi.value === "number" ? (
            <AnimatedCounter value={kpi.value} prefix={kpi.format === "currency" ? "₹" : ""} />
          ) : (
            display
          )}
        </span>
        {kpi.deltaPct !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums shadow-xs",
              up
                ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
            )}
          >
            {up ? (
              <ArrowUpRight aria-hidden className="size-3" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3" />
            )}
            {Math.abs(kpi.deltaPct)}%
          </span>
        ) : null}
      </div>

      <span
        className={cn(
          "text-[11px] font-medium",
          isError ? "text-warning" : "text-muted-foreground",
        )}
      >
        {hasValue
          ? kpi.source
          : isError
            ? `Couldn't load just now · ${kpi.source}`
            : `Awaiting first data · ${kpi.source}`}
      </span>
    </>
  );

  const containerClasses =
    "group flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md backdrop-blur-xs";

  if (kpi.href) {
    return (
      <Link
        href={kpi.href}
        className={cn(
          containerClasses,
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={containerClasses}>{content}</div>;
}
