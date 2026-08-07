/**
 * Mirrors `platform/audit/serializers.py::AuditLogSerializer` — a real,
 * directly JWT-callable endpoint (`GET /api/v1/audit/`), not a Next-only
 * aggregation. `actor` is a plain FK pk (user id), not a resolved
 * name/email — the serializer never expands it, and web doesn't either.
 *
 * `hr` is deliberately included here even though web's `TIMELINE_MODULES`
 * excludes it — HR services genuinely call `AuditService.record(module="hr",
 * ...)` (see `modules/hr/backend/services/payroll.py`), so excluding it
 * drops real, already-recorded events for no functional reason. Treat
 * web's omission as a bug, not a spec to match.
 */

export const TIMELINE_MODULES = [
  "assets",
  "inventory",
  "contracts",
  "documents",
  "purchase",
  "hr",
] as const;
export type TimelineModule = (typeof TIMELINE_MODULES)[number];

export interface AuditLogEntry {
  id: string;
  tenant: string | null;
  actor: string | null;
  action: string;
  module: string;
  object_type: string;
  object_id: string;
  ip_address: string | null;
  user_agent: string;
  changes: Record<string, unknown>;
  archived: boolean;
  created_at: string;
}

/** `vendorName` is resolved client-side, one extra fetch per unique purchase bill id — see lib/audit.ts. */
export interface TimelineEntry extends AuditLogEntry {
  vendorName?: string;
}
