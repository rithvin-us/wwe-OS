/**
 * Workspace cockpit types + client-safe helpers (no server-only imports),
 * shared between the Focus cockpit's client component and the server-only
 * fetcher in @/lib/briefing. The platform Workspace service (platform/briefing)
 * assembles all of this in one call.
 */

export type WorklistUrgency = "overdue" | "today" | "waiting" | "soon";

/** One thing that needs the operator — a pending approval or a due/overdue
 * deadline — normalised into a single actionable row. */
export interface WorklistItem {
  source: "approval" | "deadline";
  kind: string;
  label: string;
  title: string;
  subtitle: string;
  timing: string;
  urgency: WorklistUrgency;
  /** Approvals can be decided in place; deadlines link to their record. */
  actionable: boolean;
  url: string;
  object_id: string;
  extra: Record<string, unknown>;
}

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

export interface WorkspaceCockpit {
  window_days: number;
  counts: { waiting: number; overdue: number; due_soon: number };
  worklist: WorklistItem[];
  digest: {
    activity: BriefingActivity[];
    highlights: BriefingHighlight[];
  };
}

/** "finance.invoice_generated" → "invoice generated". */
export function actionPhrase(action: string): string {
  return action.replace(/^[a-z]+\./, "").replace(/[._]/g, " ");
}
