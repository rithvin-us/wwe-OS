import { cn } from "@bop/ui/lib/utils";

/**
 * Platform status language — the visual signature of the Business Operations
 * Platform. Every module surface (card, page header, palette row) renders
 * status through these primitives so state reads identically everywhere.
 */
export type PlatformStatus = "operational" | "building" | "planned" | "attention";

export const STATUS_META: Record<
  PlatformStatus,
  { label: string; text: string; dot: string; rail: string }
> = {
  operational: {
    label: "Operational",
    text: "text-status-operational",
    dot: "bg-status-operational",
    rail: "hover:border-l-status-operational",
  },
  building: {
    label: "In development",
    text: "text-status-building",
    dot: "bg-status-building",
    rail: "hover:border-l-status-building",
  },
  planned: {
    label: "Planned",
    text: "text-status-planned",
    dot: "bg-status-planned",
    rail: "hover:border-l-status-planned",
  },
  attention: {
    label: "Needs attention",
    text: "text-status-attention",
    dot: "bg-status-attention",
    rail: "hover:border-l-status-attention",
  },
};

export function StatusDot({ status, className }: { status: PlatformStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-[2px]", STATUS_META[status].dot, className)}
    />
  );
}

export function StatusChip({ status, className }: { status: PlatformStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.08em] uppercase",
        meta.text,
        className,
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}
