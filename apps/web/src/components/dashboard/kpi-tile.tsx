import { ArrowDownRight, ArrowUpRight } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { formatValue, type Kpi } from "@/config/dashboard";

/**
 * A single company KPI: the label, the live figure, its month-over-month
 * change, and where the number comes from. Nothing else — no sparkline, no
 * tally, no icon. A stat card that decorates its own number stops reading as
 * a number.
 */
export function KpiTile({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
  const display = formatValue(kpi.value, kpi.format);
  const hasValue = kpi.value !== null;
  const isError = kpi.status === "error";
  const change = kpi.deltaPct;
  const rose = change !== null && change >= 0;
  // Direction is read against what the metric means: expenses climbing is
  // not a win, so the colour follows `goodWhen`, not the sign.
  const isGood = rose === (kpi.goodWhen !== "down");

  const content = (
    <>
      <span className="text-xs text-muted-foreground">{kpi.label}</span>

      <span
        className={cn(
          "font-display text-2xl font-semibold tracking-tight tabular-nums",
          hasValue ? "text-foreground" : isError ? "text-warning" : "text-muted-foreground-subtle",
        )}
      >
        {display}
      </span>

      <div className="flex flex-col gap-1">
        {change !== null ? (
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-xs tabular-nums",
              isGood ? "text-success" : "text-destructive",
            )}
          >
            {rose ? (
              <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3.5 shrink-0" />
            )}
            {Math.abs(change)}%<span className="text-muted-foreground">vs last month</span>
          </span>
        ) : null}

        <span className={cn("text-xs", isError ? "text-warning" : "text-muted-foreground")}>
          {hasValue
            ? kpi.source
            : isError
              ? `Couldn't load just now · ${kpi.source}`
              : `Awaiting first data · ${kpi.source}`}
        </span>
      </div>
    </>
  );

  const containerClasses =
    "flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors duration-(--duration-fast) ease-out-quart animate-in fade-in slide-in-from-bottom-2 fill-mode-both";
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
          "hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
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
