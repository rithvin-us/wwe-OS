"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/api/envelope";
import { djangoFetch } from "@/lib/api/server";

/**
 * HR mutations. Server actions only — the browser never holds a token and
 * never calls Django directly.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function failed(err: unknown): ActionResult {
  if (err instanceof ApiRequestError) {
    if (err.details && typeof err.details === "object") {
      const fieldErrors = Object.entries(err.details as Record<string, unknown>)
        .map(([field, msgs]) => {
          const fieldName = field.replace(/_/g, " ");
          const msgList = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
          return `${fieldName}: ${msgList}`;
        })
        .join(" | ");
      if (fieldErrors) {
        return { ok: false, error: fieldErrors };
      }
    }
    return { ok: false, error: err.message };
  }
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

export async function createEmployee(data: {
  employee_code: string;
  name: string;
  department?: string;
  designation?: string;
  category?: string;
  date_of_joining?: string;
  basic_rate?: number;
  da_rate?: number;
  pf_number?: string;
  esic_number?: string;
  uan_number?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
}): Promise<ActionResult> {
  try {
    const payload = {
      employee_code: data.employee_code,
      employee_name: data.name,
      department: data.department || "Production",
      designation: data.designation || "Operator",
      skill_category: data.category || "Skilled",
      date_of_joining: data.date_of_joining,
      salary: data.basic_rate || 0,
      pf_number: data.pf_number || "",
      esic_number: data.esic_number || "",
      uan: data.uan_number || "",
      bank_account: data.bank_account_number || "",
      ifsc_code: data.bank_ifsc || "",
    };

    await djangoFetch("/api/v1/hr/employees/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    revalidatePath("/hr/employees");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export async function createDeduction(data: {
  employee: string;
  type: string;
  amount: number;
  year: number;
  month: number;
  notes?: string;
}): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/hr/deductions/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    revalidatePath("/hr/deductions");
    revalidatePath("/hr");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

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

export async function enrollFace(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/employees/${id}/enroll/`, {
      method: "POST",
      body: formData,
    });
    revalidatePath(`/hr/employees/${id}`);
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export async function revokeEnrollment(id: string): Promise<ActionResult> {
  try {
    await djangoFetch(`/api/v1/hr/employees/${id}/revoke-enrollment/`, {
      method: "POST",
    });
    revalidatePath(`/hr/employees/${id}`);
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export async function resetAllBiometrics(): Promise<ActionResult> {
  try {
    await djangoFetch("/api/v1/hr/employees/reset-all-biometrics/", {
      method: "POST",
    });
    revalidatePath("/hr/employees");
    return { ok: true };
  } catch (err) {
    return failed(err);
  }
}

export type CheckInResult =
  | {
      ok: true;
      data: {
        matched: boolean;
        employee_code?: string;
        employee_name?: string;
        action?: string;
        timestamp?: string;
        message?: string;
      };
    }
  | { ok: false; error: string };

export async function checkInFace(formData: FormData): Promise<CheckInResult> {
  try {
    const res = await djangoFetch<{
      matched: boolean;
      employee_code?: string;
      employee_name?: string;
      action?: string;
      timestamp?: string;
      message?: string;
    }>("/api/v1/hr/attendance/checkin/", {
      method: "POST",
      body: formData,
    });
    revalidatePath("/hr/attendance");
    revalidatePath("/hr");
    return { ok: true, data: res };
  } catch (err) {
    if (err instanceof ApiRequestError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Face check-in failed." };
  }
}
