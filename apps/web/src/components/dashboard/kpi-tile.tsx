import { ArrowDownRight, ArrowUpRight } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatValue, type Kpi } from "@/config/dashboard";

/**
 * A single company KPI. Shows the live figure, its period change, and where
 * it comes from.
 */
/** No time-series backs this yet — the curve's steepness is derived from
 * `deltaPct`'s magnitude so it stays honest about direction and size of
 * change without implying a literal history the platform doesn't have. */
function KpiSparkline({ deltaPct }: { deltaPct: number }) {
  const up = deltaPct >= 0;
  const rise = Math.min(Math.abs(deltaPct), 30) / 30;
  const y0 = up ? 22 : 6;
  const y1 = up ? 22 - rise * 18 : 6 + rise * 18;
  const points = `0,${y0} 30,${(y0 + y1) / 2 + (up ? 4 : -4)} 60,${(y0 + y1) / 2} 90,${(y0 + y1) / 2 - (up ? 2 : -2)} 120,${y1}`;
  const strokeColor = up ? "var(--success)" : "var(--destructive)";

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

export function KpiTile({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
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
          <KpiSparkline deltaPct={kpi.deltaPct ?? 0} />
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
                ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
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
          "flex items-center gap-1.5 text-[11px] font-medium",
          isError ? "text-warning" : "text-muted-foreground",
        )}
      >
        {kpi.status === "live" && (
          <span className="size-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse" />
        )}
        {hasValue
          ? kpi.source
          : isError
            ? `Couldn't load just now · ${kpi.source}`
            : `Awaiting first data · ${kpi.source}`}
      </span>
    </>
  );

  const containerClasses =
    "group flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 shadow-xs transition duration-(--duration-base) ease-out-quart hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-md backdrop-blur-xs max-md:backdrop-blur-none animate-in fade-in slide-in-from-bottom-2 fill-mode-both";
  // Design bible §7: stagger is capped around 40ms/item so a five-plus row
  // never reads as sluggish, and the tail is clamped so a long grid does not
  // keep accumulating delay. Duration comes from the motion token, not a
  // literal, so a change to the register moves this with it.
  const containerStyle = {
    animationDelay: `${Math.min(index, 6) * 40}ms`,
    animationDuration: "var(--duration-slow)",
  };

  if (kpi.href) {
    return (
      <Link
        href={kpi.href}
        className={cn(
          containerClasses,
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
        style={containerStyle}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClasses} style={containerStyle}>
      {content}
    </div>
  );
}
