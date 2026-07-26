import type { LucideIcon } from "@bop/icons";

/**
 * One figure with its label. Matches the tile used across the platform (see
 * assets/dc-analytics.tsx) so HR reads as the same software, not a bolt-on.
 *
 * `value` accepts a string so a screen can pass an em dash for "we don't know
 * yet" rather than a misleading zero.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
