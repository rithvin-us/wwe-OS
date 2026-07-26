"use server";

import { revalidatePath } from "next/cache";

import { djangoFetch } from "@/lib/api/server";

/**
 * HR mutations. Server actions only — the browser never holds a token and
 * never calls Django directly.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function failed(err: unknown): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

// ---------------------------------------------------------------- attendance

export interface AttendanceDayInput {
  day: number;
  status: string;
  shift?: string;
  in_time?: string;
  out_time?: string;
  ot_hours?: number | null;
}

export async function saveAttendance(input: {
  year: number;
  month: number;
  records: { employee_id: string; days: AttendanceDayInput[] }[];
}): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/hr/attendance/", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/hr/attendance");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

// ------------------------------------------------------------------- payroll

export async function runPayroll(year: number, month: number): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/hr/payroll/run/", {
      method: "POST",
      body: JSON.stringify({ year, month }),
    });
    revalidatePath("/hr/payroll");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

// ----------------------------------------------------------------- registers

export async function generateRegisters(year: number, month: number): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/hr/registers/generate/", {
      method: "POST",
      body: JSON.stringify({ year, month }),
    });
    revalidatePath("/hr/registers");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export async function verifyRegister(
  id: string,
): Promise<{ ok: true; valid: boolean; filename: string } | { ok: false; error: string }> {
  try {
    const result = await djangoFetch<{ valid: boolean; filename: string }>(
      `/api/v1/hr/registers/${id}/verify/`,
    );
    return { ok: true, valid: result.valid, filename: result.filename };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verification failed." };
  }
}

// --------------------------------------------------------------------- leave

export async function decideLeave(
  id: string,
  status: "approved" | "rejected",
  note = "",
): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/leave/requests/${id}/decide/`, {
      method: "POST",
      body: JSON.stringify({ status, decision_note: note }),
    });
    revalidatePath("/hr/leave");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

// ------------------------------------------------------------------ expenses

export async function decideExpense(
  id: string,
  status: "approved" | "rejected",
  note = "",
): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/expenses/${id}/decide/`, {
      method: "POST",
      body: JSON.stringify({ status, decision_note: note }),
    });
    revalidatePath("/hr/expenses");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

// ---------------------------------------------------------------- checklists

export async function completeTask(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/checklists/tasks/${id}/complete/`, { method: "POST" });
    revalidatePath("/hr/employees");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export async function reopenTask(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/checklists/tasks/${id}/reopen/`, { method: "POST" });
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

// ----------------------------------------------------------------- employees

export async function offboardEmployee(id: string, dateOfLeaving: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/employees/${id}/?date_of_leaving=${dateOfLeaving}`, {
      method: "DELETE",
    });
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}
