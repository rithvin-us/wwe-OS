export const TIMELINE_MODULES = [
  "assets",
  "inventory",
  "contracts",
  "documents",
  "purchase",
] as const;

export type TimelineModule = (typeof TIMELINE_MODULES)[number];

export interface AuditLogEntry {
  id: string;
  actor: string | null;
  action: string;
  module: string;
  object_type: string;
  object_id: string;
  changes: Record<string, unknown>;
  archived: boolean;
  created_at: string;
}

export interface TimelineEntry extends AuditLogEntry {
  vendorName?: string;
}

const MODULE_DETAIL_HREF: Partial<Record<TimelineModule, (id: string) => string>> = {
  contracts: (id) => `/contracts/${id}`,
  inventory: (id) => `/inventory/${id}`,
  documents: (id) => `/dms/${id}`,
};

const MODULE_LIST_HREF: Record<TimelineModule, string> = {
  assets: "/assets",
  inventory: "/inventory",
  contracts: "/contracts",
  documents: "/dms",
  purchase: "/purchase",
};

export function timelineHref(entry: Pick<AuditLogEntry, "module" | "object_id">): string | null {
  const entryModule = entry.module as TimelineModule;
  const detail = MODULE_DETAIL_HREF[entryModule];
  if (detail && entry.object_id) return detail(entry.object_id);
  return MODULE_LIST_HREF[entryModule] ?? null;
}

export function describeEntry(entry: TimelineEntry): string {
  const changes = entry.changes || {};
  const candidate =
    changes._simulated_title || changes.title || changes.name || changes.asset_tag || changes.sku;
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  return entry.object_type || entry.module;
}

export function activityLabel(entry: AuditLogEntry): string {
  return `${describeEntry(entry)} — ${entry.action.replace(/[._]/g, " ")}`;
}

/** Event counts per module for the Timeline's activity-volume chart —
 * derived from real audit entries, most-active first. Empty in, empty out;
 * never a fabricated series. */
export function eventsByModule(
  entries: Pick<AuditLogEntry, "module">[],
): { module: string; events: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.module, (counts.get(entry.module) ?? 0) + 1);
  return [...counts.entries()]
    .map(([module, events]) => ({ module, events }))
    .sort((a, b) => b.events - a.events);
}
