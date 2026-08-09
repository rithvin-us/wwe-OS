import { djangoFetch, djangoFetchPage } from "@/lib/api/server";

/** The business modules the Timeline covers — everything else in the audit
 * trail (auth, users, permissions, notifications) is session/account
 * plumbing, not company activity, and stays out of a business-facing feed. */
export const TIMELINE_MODULES = [
  "assets",
  "inventory",
  "contracts",
  "documents",
  "purchase",
  "notes",
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
  /** Resolved only for purchase/PurchaseBill rows via a live lookup — the
   * bill's CURRENT vendor, not necessarily the vendor at event time (a bill
   * reassigned to a different vendor later shows today's vendor here). */
  vendorName?: string;
}

export interface TimelineFilters {
  module?: TimelineModule;
  objectType?: string;
  objectId?: string;
  dateFrom?: string;
  dateTo?: string;
  vendor?: string;
  page?: number;
}

export interface TimelinePage {
  entries: TimelineEntry[];
  count: number;
  page: number;
  pages: number;
  /** True when `vendor` narrowed results client-side after the fetch — count
   * and pages then describe only this page, not the full result set (the
   * audit API can't filter by vendor server-side; see getTimeline). */
  vendorFiltered: boolean;
}

const PAGE_SIZE = 25;

export async function getTimeline(filters: TimelineFilters = {}): Promise<TimelinePage> {
  const params = new URLSearchParams({ ordering: "-created_at", page_size: String(PAGE_SIZE) });
  // A vendor only means anything on purchase bills — filtering by vendor
  // implicitly scopes the query to the purchase module.
  const effectiveModule = filters.vendor ? "purchase" : filters.module;
  if (effectiveModule) params.set("module", effectiveModule);
  else params.set("module__in", TIMELINE_MODULES.join(","));
  if (filters.objectType) params.set("object_type", filters.objectType);
  if (filters.objectId) params.set("object_id", filters.objectId);
  if (filters.dateFrom) params.set("created_at__gte", filters.dateFrom);
  if (filters.dateTo) params.set("created_at__lte", filters.dateTo);
  if (filters.page) params.set("page", String(filters.page));

  const { data, meta } = await djangoFetchPage<AuditLogEntry[]>(
    `/api/v1/audit/?${params.toString()}`,
  );
  let entries: TimelineEntry[] = data ?? [];

  const billIds = Array.from(
    new Set(
      entries
        .filter((e) => e.module === "purchase" && e.object_type === "PurchaseBill" && e.object_id)
        .map((e) => e.object_id),
    ),
  );
  if (billIds.length > 0) {
    const vendorByBillId = await resolveVendorNames(billIds);
    entries = entries.map((e) => ({ ...e, vendorName: vendorByBillId.get(e.object_id) }));
  }

  const vendorFiltered = Boolean(filters.vendor);
  if (vendorFiltered) {
    const needle = filters.vendor!.trim().toLowerCase();
    entries = entries.filter((e) => (e.vendorName ?? "").toLowerCase().includes(needle));
  }

  return {
    entries,
    count: vendorFiltered ? entries.length : meta.count,
    page: meta.page,
    pages: vendorFiltered ? 1 : meta.pages,
    vendorFiltered,
  };
}

async function resolveVendorNames(billIds: string[]): Promise<Map<string, string>> {
  const resolved = await Promise.all(
    billIds.map(async (id): Promise<[string, string]> => {
      try {
        const bill = await djangoFetch<{ vendor: { name: string } | null; seller_name: string }>(
          `/api/v1/purchase/bills/${id}/`,
        );
        return [id, bill.vendor?.name || bill.seller_name || ""];
      } catch {
        return [id, ""];
      }
    }),
  );
  return new Map(resolved.filter(([, name]) => name));
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
  notes: "/timeline",
};

/** Best available link for a timeline entry: the record's own detail page
 * where one exists (contracts, inventory, documents), otherwise the
 * module's list page (assets and purchase bills open in a dialog from
 * their list, with no deep-linkable detail URL today). */
export function timelineHref(entry: Pick<AuditLogEntry, "module" | "object_id">): string | null {
  const entryModule = entry.module as TimelineModule;
  const detail = MODULE_DETAIL_HREF[entryModule];
  if (detail && entry.object_id) return detail(entry.object_id);
  return MODULE_LIST_HREF[entryModule] ?? null;
}

/** A one-line label for an entry: whatever the recording module put in
 * `changes` under a common title-ish key, else the object type. */
export function describeEntry(entry: TimelineEntry): string {
  const changes = entry.changes;
  const candidate = changes.title ?? changes.name ?? changes.asset_tag ?? changes.sku;
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  return entry.object_type || entry.module;
}

/** "<record> — <action>", e.g. "Acme Corp — bill created" — the Executive
 * Dashboard's recent-activity line for one audit entry. */
export function activityLabel(entry: AuditLogEntry): string {
  return `${describeEntry(entry)} — ${entry.action.replace(/[._]/g, " ")}`;
}

/** Today's activity across the business modules — the Executive
 * Dashboard's "recent activity" feed, not scoped to any one record. */
export async function getTodayActivity(limit = 8): Promise<AuditLogEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    module__in: TIMELINE_MODULES.join(","),
    created_at__gte: today,
    ordering: "-created_at",
    page_size: String(limit),
  });
  try {
    return await djangoFetch<AuditLogEntry[]>(`/api/v1/audit/?${params.toString()}`);
  } catch {
    return [];
  }
}
