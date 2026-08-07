import type { LucideIcon } from "@bop/icons";
import { Skeleton } from "@bop/ui/components/skeleton";
import { cn } from "@bop/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatValue, type SummaryRow } from "@/config/dashboard";

/**
 * One card shape for every panel on the command center: titled, optional
 * "open" link to the full area, and a body that is either content or a quiet
 * empty state. Same shape everywhere — `tone="warning"` is the one deliberate
 * exception, reserved for a section whose real content genuinely needs
 * elevated attention (never applied for decoration).
 */
export function SectionCard({
  title,
  icon: Icon,
  href,
  children,
  className,
  tone = "default",
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning";
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-lg border bg-card transition-shadow duration-(--duration-base)",
        tone === "warning" ? "border-warning/40 bg-warning/5" : "border-border",
        href && "hover:shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <Icon
            aria-hidden
            className={cn("size-4", tone === "warning" ? "text-warning" : "text-muted-foreground")}
          />
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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
                known ? "text-foreground" : "text-muted-foreground-subtle",
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

/**
 * Loading placeholder matching {@link SectionCard}'s exact shape (border,
 * header height, padding) so streaming-in content never shifts layout.
 */
export function SectionCardSkeleton({
  title,
  icon: Icon,
  rows = 3,
  className,
}: {
  title: string;
  icon: LucideIcon;
  rows?: number;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-border bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <Icon aria-hidden className="size-4 text-muted-foreground/80" />
          {title}
        </h2>
      </header>
      <div className="flex-1 space-y-2.5 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </section>
  );
}
