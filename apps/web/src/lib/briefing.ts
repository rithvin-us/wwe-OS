import "server-only";

import { djangoFetch } from "@/lib/api/server";

/** "What changed?" — assembled by the platform Briefing service from the audit
 * trail plus the approval/deadline aggregators. Every number traces to records. */
export interface BriefingActivity {
  module: string;
  action: string;
  count: number;
}

export interface BriefingHighlight {
  action: string;
  module: string;
  object_type: string;
  object_id: string;
  at: string;
  changes: Record<string, unknown>;
}

export interface BriefingSummary {
  window_days: number;
  activity: BriefingActivity[];
  highlights: BriefingHighlight[];
  attention: {
    pending_approvals: number;
    overdue: number;
    due_soon: number;
  };
}

export async function getBriefing(days = 7): Promise<BriefingSummary> {
  return djangoFetch<BriefingSummary>(`/api/v1/briefing/?days=${days}`);
}

export function actionPhrase(action: string): string {
  return action.replace(/^[a-z]+\./, "").replace(/[._]/g, " ");
}
