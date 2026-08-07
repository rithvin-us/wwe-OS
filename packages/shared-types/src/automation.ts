/**
 * Mirrors `apps/web/src/config/automation.ts`, cross-checked against
 * `platform/automation/serializers.py`.
 *
 * Two honesty notes carried into the mobile UI, not just this file:
 * - `email`/`cloud_storage` destinations (`STUB_DESTINATIONS`) can be saved
 *   but `AutomationService.run_rule` refuses to execute them — always show
 *   as "coming soon", never let a rule with one of these run.
 * - `cadence`/`next_run_at` are stored and really do advance correctly, but
 *   nothing in this deployment calls `automation_run_due` on a timer (no
 *   cron/Celery beat wired up anywhere) — only "Run now" (`run-now/`)
 *   actually executes a rule today. Don't imply the app fires these itself.
 */

export type AutomationDestination =
  "downloaded_package" | "generate_report" | "auditor_folder" | "email" | "cloud_storage";

export const STUB_DESTINATIONS: AutomationDestination[] = ["email", "cloud_storage"];

export type AutomationCadence = "once" | "daily" | "weekly" | "monthly";

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  source_modules: string[];
  required_tags: string[];
  destination: AutomationDestination;
  report_key: string;
  export_format: string;
  cadence: AutomationCadence;
  next_run_at: string | null;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunItem {
  module?: string;
  object_type?: string;
  object_id: string;
  title: string;
  included: boolean;
}

export interface AutomationRun {
  id: string;
  rule: string | null;
  rule_name: string;
  destination: AutomationDestination;
  status: "success" | "failed";
  triggered_by: "schedule" | "manual";
  started_at: string;
  finished_at: string;
  item_count: number;
  items: AutomationRunItem[];
  filename: string | null;
  report_export_id: string | null;
  download_url: string | null;
  error_message: string;
  created_at: string;
}

export interface AutomationSource {
  module: string;
  label: string;
}

/** POST/PATCH .../rules/ body — all optional on PATCH, name+destination+cadence+next_run_at required on create. */
export interface RuleWriteInput {
  name?: string;
  description?: string;
  destination?: AutomationDestination;
  source_modules?: string[];
  report_key?: string;
  export_format?: string;
  required_tags?: string[];
  cadence?: AutomationCadence;
  next_run_at?: string;
  is_active?: boolean;
}
