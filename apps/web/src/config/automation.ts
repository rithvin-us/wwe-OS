/** Automation types and constants — client-safe (no server-only imports),
 * shared between the automation page, its client components, and the
 * server-only fetchers in @/lib/automation. */

export type AutomationDestination =
  "downloaded_package" | "generate_report" | "auditor_folder" | "email" | "cloud_storage";

export type AutomationCadence = "once" | "daily" | "weekly" | "monthly";

export const STUB_DESTINATIONS: AutomationDestination[] = ["email", "cloud_storage"];

export const DESTINATION_LABELS: Record<AutomationDestination, string> = {
  downloaded_package: "Downloaded package",
  generate_report: "Generate report",
  auditor_folder: "Auditor folder",
  email: "Email",
  cloud_storage: "Cloud storage",
};

export const CADENCE_LABELS: Record<AutomationCadence, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

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
  error_message: string;
  created_at: string;
}

export interface AutomationSource {
  module: string;
  label: string;
}
