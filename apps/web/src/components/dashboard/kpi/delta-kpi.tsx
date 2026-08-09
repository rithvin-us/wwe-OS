import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

/**
 * Change-first tile — the percentage move is the headline, the absolute
 * value is secondary. For KPIs where "how much did this shift" matters more
 * than the raw number.
 */
export function DeltaKpi({
  label,
  icon: Icon,
  deltaPct,
  comparedTo = "vs last month",
  href,
}: {
  label: string;
  icon: LucideIcon;
  deltaPct: number;
  comparedTo?: string;
  href?: string;
}) {
  const up = deltaPct >= 0;

  const content = (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "flex items-center gap-0.5 font-display text-2xl font-bold tracking-tight tabular-nums",
            up ? "text-success" : "text-destructive",
          )}
        >
          {up ? (
            <ArrowUpRight aria-hidden className="size-5" />
          ) : (
            <ArrowDownRight aria-hidden className="size-5" />
          )}
          {up ? "+" : "−"}
          {Math.abs(deltaPct)}%
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">{comparedTo}</span>
    </div>
  );

  const classes =
    "rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";

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
