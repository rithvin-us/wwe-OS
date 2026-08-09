import { Badge } from "@bop/ui/components/badge";
import type { LucideIcon } from "@bop/icons";
import Link from "next/link";
import { cn } from "@bop/ui/lib/utils";

export type KpiStatusLevel = "stable" | "attention" | "risk";

const STATUS_COPY: Record<
  KpiStatusLevel,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  stable: { label: "Stable", variant: "success" },
  attention: { label: "Needs review", variant: "warning" },
  risk: { label: "At risk", variant: "destructive" },
};

/**
 * State without a number — for KPIs whose honest answer is a condition, not
 * a figure. Color and label always paired (Reserved Vocabulary Rule): these
 * are semantic/business-outcome colors, never the module-lifecycle palette.
 */
export function StatusKpi({
  label,
  icon: Icon,
  status,
  description,
  href,
}: {
  label: string;
  icon: LucideIcon;
  status: KpiStatusLevel;
  description: string;
  href?: string;
}) {
  const copy = STATUS_COPY[status];

  const content = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          {label}
        </span>
        <Badge variant={copy.variant}>{copy.label}</Badge>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
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
