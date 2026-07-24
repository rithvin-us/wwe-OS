"use server";

import { revalidatePath } from "next/cache";
import { ApiRequestError } from "@/lib/api/envelope";
import type { AutomationCadence, AutomationDestination, AutomationRun } from "@/config/automation";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

export interface RunActionResult extends ActionResult {
  run?: AutomationRun;
}

const BASE = "/api/v1/automation/rules";

export interface CreateRuleInput {
  name: string;
  description: string;
  destination: AutomationDestination;
  source_modules: string[];
  report_key: string;
  export_format: string;
  required_tags: string[];
  cadence: AutomationCadence;
  next_run_at: string;
}

export async function createRuleAction(input: CreateRuleInput): Promise<ActionResult> {
  try {
    const rule = await djangoFetch<{ id: string }>(`${BASE}/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/automation");
    return { ok: true, message: "Rule created.", id: rule.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
export interface UpdateRuleInput {
  name?: string;
  description?: string;
  destination?: AutomationDestination;
  source_modules?: string[];
  report_key?: string;
  export_format?: string;
  required_tags?: string[];
  cadence?: AutomationCadence;
  next_run_at?: string;
}

export async function updateRuleAction(id: string, input: UpdateRuleInput): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidatePath("/automation");
    return { ok: true, message: "Rule updated." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function toggleRuleActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
    revalidatePath("/automation");
    return { ok: true, message: isActive ? "Rule resumed." : "Rule paused." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteRuleAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/automation");
    return { ok: true, message: "Rule deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function runRuleNowAction(id: string): Promise<RunActionResult> {
  try {
    const run = await djangoFetch<AutomationRun>(`${BASE}/${id}/run-now/`, { method: "POST" });
    revalidatePath("/automation");
    return {
      ok: run.status === "success",
      message:
        run.status === "success"
          ? `Run complete — ${run.item_count} item${run.item_count === 1 ? "" : "s"}.`
          : run.error_message || "Run failed.",
      run,
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}
