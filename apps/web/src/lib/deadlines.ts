import "server-only";

import { djangoFetch } from "@/lib/api/server";

/** One aggregated view of every date-sensitive record (invoice due dates,
 * contract expiry, …) the operator may see, soonest first. Assembled by the
 * platform Deadline Engine. */
export interface DeadlineRow {
  kind: string;
  label: string;
  due_date: string;
  days_remaining: number;
  is_overdue: boolean;
  url: string;
  object_id: string;
  extra: Record<string, unknown>;
}

export async function getDeadlines(days = 30): Promise<DeadlineRow[]> {
  return djangoFetch<DeadlineRow[]>(`/api/v1/deadlines/?days=${days}`);
}

export const DEADLINE_KIND_LABELS: Record<string, string> = {
  invoice_due: "Invoice",
  contract_expiry: "Contract",
};

export function deadlineKindLabel(kind: string): string {
  return DEADLINE_KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

export function deadlineTiming(row: DeadlineRow): string {
  if (row.is_overdue) return `Overdue by ${Math.abs(row.days_remaining)}d`;
  if (row.days_remaining === 0) return "Due today";
  return `In ${row.days_remaining}d`;
}
