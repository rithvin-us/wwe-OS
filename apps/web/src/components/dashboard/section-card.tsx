import type { LucideIcon } from "@bop/icons";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatValue, type SummaryRow } from "@/config/dashboard";

/**
 * One card shape for every panel on the command center: titled, optional
 * "open" link to the full area, and a body that is either content or a quiet
 * empty state. Keeps every dashboard section visually identical.
 */
export function SectionCard({
  title,
  icon: Icon,
  href,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <Icon aria-hidden className="size-4 text-muted-foreground/80" />
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Open
          </Link>
        ) : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

/** A list of label/value rows for summary panels. */
export function SummaryRows({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="space-y-2.5">
      {rows.map((row) => {
        const known = row.value !== null;
        return (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd
              className={cn(
                "text-sm font-medium tabular-nums",
                known ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {formatValue(row.value, row.format)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Quiet empty state for list panels — inviting, never an error. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[13px] text-muted-foreground">{children}</p>;
}
