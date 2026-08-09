"use server";

import { revalidatePath } from "next/cache";
import { ApiRequestError } from "@/lib/api/envelope";
import type { AlertChannel, AlertConditionType, AlertMetric, AlertOperator } from "@/config/alerts";
import { djangoFetch } from "@/lib/api/server";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

export interface CheckNowResult extends ActionResult {
  fired?: boolean;
}

const BASE = "/api/v1/alerts/rules";

export interface CreateAlertRuleInput {
  name: string;
  condition_type: AlertConditionType;
  metric: AlertMetric;
  operator?: AlertOperator | "";
  threshold_value?: string;
  schedule_time?: string;
  channel: AlertChannel;
  message_template?: string;
}

export async function createAlertRuleAction(input: CreateAlertRuleInput): Promise<ActionResult> {
  try {
    const rule = await djangoFetch<{ id: string }>(`${BASE}/`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/automation");
    return { ok: true, message: "Alert rule created.", id: rule.id };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function toggleAlertRuleActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
    revalidatePath("/automation");
    return { ok: true, message: isActive ? "Alert resumed." : "Alert paused." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function deleteAlertRuleAction(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`${BASE}/${id}/`, { method: "DELETE" });
    revalidatePath("/automation");
    return { ok: true, message: "Alert rule deleted." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function checkAlertRuleNowAction(id: string): Promise<CheckNowResult> {
  try {
    const result = await djangoFetch<{ fired: boolean }>(`${BASE}/${id}/check-now/`, {
      method: "POST",
    });
    revalidatePath("/automation");
    return {
      ok: true,
      fired: result.fired,
      message: result.fired ? "Condition met — alert sent." : "Checked — condition not met.",
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}
