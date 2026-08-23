import type { LucideIcon } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

/**
 * A single completion figure as a horizontal bar — for KPIs that are
 * fundamentally "how far through X are we," where a bare number would lose
 * the sense of how much is left.
 */
export function ProgressKpi({
  label,
  icon: Icon,
  percent,
  detail,
  href,
}: {
  label: string;
  icon: LucideIcon;
  /** 0–100, or null when there isn't enough real data yet to compute it. */
  percent: number | null;
  detail: string;
  href?: string;
}) {
  const known = percent !== null;
  const clamped = known ? Math.min(100, Math.max(0, percent)) : 0;

  const content = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {label}
        </span>
        <span
          className={cn(
            "font-display text-sm font-bold tabular-nums",
            known ? "text-foreground" : "text-muted-foreground-subtle",
          )}
        >
          {known ? `${Math.round(clamped)}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-(--duration-slow) ease-out-quart"
          style={{ width: `${known ? clamped : 0}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );

  const classes =
    "rounded-xl border border-border bg-card p-4 shadow-xs transition duration-(--duration-base) ease-out-quart hover:-translate-y-0.5 hover:shadow-md";

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
