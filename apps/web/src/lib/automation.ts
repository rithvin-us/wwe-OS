import { djangoFetch } from "@/lib/api/server";
import type { AutomationRule, AutomationRun, AutomationSource } from "@/config/automation";

export type {
  AutomationRule,
  AutomationRun,
  AutomationRunItem,
  AutomationSource,
  AutomationDestination,
  AutomationCadence,
} from "@/config/automation";

export async function getRules(): Promise<AutomationRule[]> {
  try {
    return await djangoFetch<AutomationRule[]>(
      "/api/v1/automation/rules/?ordering=-created_at&page_size=100",
    );
  } catch {
    return [];
  }
}

export async function getActiveRules(): Promise<AutomationRule[]> {
  try {
    return await djangoFetch<AutomationRule[]>(
      "/api/v1/automation/rules/?is_active=true&page_size=100",
    );
  } catch {
    return [];
  }
}

export async function getRuleSources(): Promise<AutomationSource[]> {
  try {
    return await djangoFetch<AutomationSource[]>("/api/v1/automation/rules/sources/");
  } catch {
    return [];
  }
}

export async function getRunHistory(ruleId?: string): Promise<AutomationRun[]> {
  const query = ruleId ? `&rule=${ruleId}` : "";
  try {
    return await djangoFetch<AutomationRun[]>(
      `/api/v1/automation/runs/?ordering=-created_at&page_size=50${query}`,
    );
  } catch {
    return [];
  }
}

export async function getRun(id: string): Promise<AutomationRun | null> {
  try {
    return await djangoFetch<AutomationRun>(`/api/v1/automation/runs/${id}/`);
  } catch {
    return null;
  }
}
