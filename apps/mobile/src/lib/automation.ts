import type {
  AutomationRule,
  AutomationRun,
  AutomationSource,
  RuleWriteInput,
} from "@bop/shared-types";

import { api } from "@/lib/api";
import { downloadReportFile } from "@/lib/reports";

const RULES_BASE = "/api/v1/automation/rules";
const RUNS_BASE = "/api/v1/automation/runs";

export function getRules() {
  return api.request<AutomationRule[]>(`${RULES_BASE}/?ordering=-created_at&page_size=100`);
}

export function getRuleSources() {
  return api.request<AutomationSource[]>(`${RULES_BASE}/sources/`);
}

export function createRule(input: RuleWriteInput) {
  return api.request<AutomationRule>(`${RULES_BASE}/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRule(id: string, input: RuleWriteInput) {
  return api.request<AutomationRule>(`${RULES_BASE}/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setRuleActive(id: string, isActive: boolean) {
  return updateRule(id, { is_active: isActive });
}

export function deleteRule(id: string) {
  return api.request<null>(`${RULES_BASE}/${id}/`, { method: "DELETE" });
}

/** POST .../rules/{id}/run-now/ — the only thing that actually executes a rule in this deployment. */
export function runRuleNow(id: string) {
  return api.request<AutomationRun>(`${RULES_BASE}/${id}/run-now/`, { method: "POST" });
}

export function getRunHistory(ruleId?: string) {
  const query = ruleId
    ? `?ordering=-created_at&page_size=50&rule=${ruleId}`
    : "?ordering=-created_at&page_size=50";
  return api.request<AutomationRun[]>(`${RUNS_BASE}/${query}`);
}

export function getRun(id: string) {
  return api.request<AutomationRun>(`${RUNS_BASE}/${id}/`);
}

/**
 * `download_url` is usually already populated on the run (a signed URL, no
 * Bearer header needed — same pattern as Reports, `reports.ts`), but falls
 * back to re-minting one when the run only produced a linked report export.
 */
export async function openRunOutput(run: AutomationRun): Promise<void> {
  if (run.download_url) {
    await downloadReportFile(run.download_url);
    return;
  }
  if (run.report_export_id) {
    const { url } = await api.request<{ url: string }>(
      `/api/v1/reporting/exports/${run.report_export_id}/url/`,
    );
    await downloadReportFile(url);
    return;
  }
  const { url } = await api.request<{ url: string }>(`${RUNS_BASE}/${run.id}/url/`);
  await downloadReportFile(url);
}
