import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import { formatValue, type KpiFormat } from "@/config/dashboard";

/** No time-series backs this yet — the curve's steepness is derived from
 * `deltaPct`'s magnitude so it stays honest about direction and size of
 * change without implying a literal history the platform doesn't have. */
function Sparkline({ deltaPct }: { deltaPct: number }) {
  const up = deltaPct >= 0;
  const rise = Math.min(Math.abs(deltaPct), 30) / 30;
  const y0 = up ? 22 : 6;
  const y1 = up ? 22 - rise * 18 : 6 + rise * 18;
  const points = `0,${y0} 30,${(y0 + y1) / 2 + (up ? 4 : -4)} 60,${(y0 + y1) / 2} 90,${(y0 + y1) / 2 - (up ? 2 : -2)} 120,${y1}`;

  return (
    <svg
      className="h-7 w-16 shrink-0 overflow-visible opacity-70 transition-opacity group-hover:opacity-100"
      viewBox="0 0 120 28"
      fill="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={up ? "var(--success)" : "var(--destructive)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/**
 * Value + shape + direction in one horizontal read — for KPIs where the
 * trajectory matters as much as the current number.
 */
export function TrendKpi({
  label,
  icon: Icon,
  value,
  format,
  deltaPct,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number | null;
  format: KpiFormat;
  deltaPct: number;
  href?: string;
}) {
  const up = deltaPct >= 0;
  const hasValue = value !== null;

  const content = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {hasValue ? (
              <AnimatedCounter value={value} prefix={format === "currency" ? "₹" : ""} />
            ) : (
              formatValue(value, format)
            )}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums",
              up ? "text-success" : "text-destructive",
            )}
          >
            {up ? (
              <ArrowUpRight aria-hidden className="size-3" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3" />
            )}
            {Math.abs(deltaPct)}%
          </span>
        </div>
      </div>
      <Sparkline deltaPct={deltaPct} />
    </div>
  );

  const classes =
    "group rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          "block focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
