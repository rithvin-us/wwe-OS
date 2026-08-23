import "server-only";

import { djangoFetch } from "@/lib/api/server";

/** One inbox of every pending human decision (leave, expenses, …) the operator
 * may see, longest-waiting first. Assembled by the platform Approval Center. */
export interface ApprovalRow {
  kind: string;
  label: string;
  object_id: string;
  title: string;
  requester: string;
  submitted_at: string | null;
  priority: string;
  current_step: string;
  url: string;
  extra: Record<string, unknown>;
}

export async function getApprovals(): Promise<ApprovalRow[]> {
  return djangoFetch<ApprovalRow[]>("/api/v1/approvals/");
}
