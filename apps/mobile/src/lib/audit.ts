import type { AuditLogEntry, TimelineEntry, TimelineModule } from "@bop/shared-types";
import { TIMELINE_MODULES } from "@bop/shared-types";

import { api } from "@/lib/api";
import { getPurchaseBill } from "@/lib/purchase";

export interface TimelineFilters {
  module?: TimelineModule;
  dateFrom?: string;
  dateTo?: string;
}

const PAGE_SIZE = 25;

async function resolveVendorNames(entries: AuditLogEntry[]): Promise<TimelineEntry[]> {
  const billIds = [
    ...new Set(
      entries
        .filter((e) => e.module === "purchase" && e.object_type === "PurchaseBill")
        .map((e) => e.object_id),
    ),
  ];
  if (billIds.length === 0) return entries;

  const names = new Map<string, string>();
  await Promise.all(
    billIds.map(async (id) => {
      try {
        const bill = await getPurchaseBill(id);
        names.set(id, bill.vendor?.name || bill.seller_name);
      } catch {
        // A deleted/unreadable bill just means no vendor label for that row.
      }
    }),
  );
  return entries.map((e) =>
    names.has(e.object_id) ? { ...e, vendorName: names.get(e.object_id) } : e,
  );
}

/**
 * `GET /api/v1/audit/` directly — a real, standard JWT-authenticated
 * endpoint (`platform/audit`), not a Next-only aggregation. Page-based:
 * fewer than `PAGE_SIZE` entries back means there's no next page. No
 * pagination `meta` here (the SDK's `request()` unwraps `{success,data}`
 * only, same as every other module) — a feed screen doesn't need exact
 * counts, just "is there more."
 */
export async function getTimeline(
  filters: TimelineFilters = {},
  page = 1,
): Promise<TimelineEntry[]> {
  const params = new URLSearchParams({
    ordering: "-created_at",
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  if (filters.module) {
    params.set("module", filters.module);
  } else {
    params.set("module__in", TIMELINE_MODULES.join(","));
  }
  if (filters.dateFrom) params.set("created_at__gte", filters.dateFrom);
  if (filters.dateTo) params.set("created_at__lte", filters.dateTo);

  const entries = await api.request<AuditLogEntry[]>(`/api/v1/audit/?${params}`);
  return resolveVendorNames(entries);
}

const MODULE_LIST_HREF: Record<string, string> = {
  documents: "/dms",
  purchase: "/purchase/bills",
  assets: "/assets",
  hr: "/hr",
};

const MODULE_DETAIL_HREF: Record<string, (id: string) => string> = {
  documents: (id) => `/dms/${id}`,
  purchase: (id) => `/purchase/bills/${id}`,
};

/** Best link for an entry — a real detail route if one exists on mobile, else the module's list, else none. */
export function timelineHref(entry: TimelineEntry): string | null {
  const detail = MODULE_DETAIL_HREF[entry.module];
  if (detail) return detail(entry.object_id);
  return MODULE_LIST_HREF[entry.module] ?? null;
}

export function describeEntry(entry: TimelineEntry): string {
  const changes = entry.changes as Record<string, unknown>;
  const title = changes?.title ?? changes?.name ?? changes?.asset_tag ?? changes?.sku;
  if (typeof title === "string" && title) return title;
  if (entry.vendorName) return entry.vendorName;
  return entry.object_type || entry.module;
}

export function activityLabel(entry: TimelineEntry): string {
  return `${describeEntry(entry)} — ${entry.action.replace(/[._]/g, " ")}`;
}
