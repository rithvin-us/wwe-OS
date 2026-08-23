import { ArrowRight, type LucideIcon } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";

import { AnimatedCounter } from "@/components/ui/animated-counter";

/**
 * A count that exists to be clicked — the number is really an invitation to
 * go look at the area behind it, not a figure to sit with.
 */
export function ActionKpi({
  label,
  icon: Icon,
  value,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition duration-(--duration-base) ease-out-quart hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
          <Icon aria-hidden className="size-4" />
        </span>
        <div>
          <span className="font-display text-xl font-bold tabular-nums text-foreground">
            <AnimatedCounter value={value} />
          </span>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
      <ArrowRight
        aria-hidden
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground",
        )}
      />
    </Link>
  );
}
