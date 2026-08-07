import type {
  AnomalyReport,
  AttendanceGrid,
  CheckInResponse,
  CreateLeaveRequestPayload,
  Employee,
  EnrollResponse,
  ExpenseClaim,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  WorkforceSummary,
} from "@bop/shared-types";

import { api } from "@/lib/api";
import { fileFormData, type LocalFile } from "@/lib/local-file";

export function getEmployees(params: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams({ page_size: "200", ...params });
  return api.request<Employee[]>(`/api/v1/hr/employees/?${query}`);
}

export function getEmployee(id: string) {
  return api.request<Employee>(`/api/v1/hr/employees/${id}/`);
}

export function getAttendanceGrid(year: number, month: number) {
  return api.request<AttendanceGrid>(`/api/v1/hr/attendance/?year=${year}&month=${month}`);
}

export function getWorkforceSummary(year: number, month: number) {
  return api.request<WorkforceSummary>(`/api/v1/hr/analytics/summary/?year=${year}&month=${month}`);
}

export function getAnomalies(year: number, month: number) {
  return api.request<AnomalyReport>(`/api/v1/hr/analytics/anomalies/?year=${year}&month=${month}`);
}

export function getLeaveTypes() {
  return api.request<LeaveType[]>("/api/v1/hr/leave/types/?page_size=100");
}

export function getLeaveRequests(status?: string) {
  const query = status ? `?page_size=200&status=${status}` : "?page_size=200";
  return api.request<LeaveRequest[]>(`/api/v1/hr/leave/requests/${query}`);
}

export function getLeaveBalances(year: number) {
  return api.request<LeaveBalance[]>(`/api/v1/hr/leave/balances/?year=${year}`);
}

export function createLeaveRequest(payload: CreateLeaveRequestPayload) {
  return api.request<LeaveRequest>("/api/v1/hr/leave/requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function withdrawLeaveRequest(id: string) {
  return api.request<null>(`/api/v1/hr/leave/requests/${id}/`, { method: "DELETE" });
}

export function decideLeave(id: string, status: "approved" | "rejected", note?: string) {
  return api.request<LeaveRequest>(`/api/v1/hr/leave/requests/${id}/decide/`, {
    method: "POST",
    body: JSON.stringify({ status, note: note ?? "" }),
  });
}

export function decideExpense(id: string, status: "approved" | "rejected", note?: string) {
  return api.request<ExpenseClaim>(`/api/v1/hr/expenses/${id}/decide/`, {
    method: "POST",
    body: JSON.stringify({ status, note: note ?? "" }),
  });
}

export function getExpenseClaims(status?: string) {
  const query = status ? `?page_size=200&status=${status}` : "?page_size=200";
  return api.request<ExpenseClaim[]>(`/api/v1/hr/expenses/${query}`);
}

export async function createExpenseClaim(
  payload: {
    employee: string;
    expense_date: string;
    amount: number;
    category?: string;
    description?: string;
  },
  receipt?: LocalFile,
) {
  if (!receipt) {
    return api.request<ExpenseClaim>("/api/v1/hr/expenses/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  const form = fileFormData("receipt", receipt, {
    employee: payload.employee,
    expense_date: payload.expense_date,
    amount: String(payload.amount),
    category: payload.category ?? "",
    description: payload.description ?? "",
  });
  return api.request<ExpenseClaim>("/api/v1/hr/expenses/", { method: "POST", body: form });
}

export function getExpenseReceiptUrl(id: string) {
  return api.request<{ url: string }>(`/api/v1/hr/expenses/${id}/receipt/`);
}

/**
 * POST /api/v1/hr/attendance/checkin/ — public, unauthenticated (no login on
 * a shop-floor device), pure 1:N face match. `frames`/`lat`/`lon`/`accuracy`
 * are optional extras the web kiosk doesn't send; sending them here buys
 * liveness + geofence checks the backend already supports.
 */
export async function checkInFace(
  selfie: LocalFile,
  location?: { lat: number; lon: number; accuracy?: number },
) {
  const form = fileFormData("file", selfie);
  if (location) {
    form.append("lat", String(location.lat));
    form.append("lon", String(location.lon));
    if (location.accuracy !== undefined) form.append("accuracy", String(location.accuracy));
  }
  return api.request<CheckInResponse>("/api/v1/hr/attendance/checkin/", {
    method: "POST",
    body: form,
  });
}

/** POST /api/v1/hr/employees/{id}/enroll/ — authenticated, requires hr.employee.enroll. */
export function enrollFace(employeeId: string, photo: LocalFile) {
  const form = fileFormData("file", photo);
  return api.request<EnrollResponse>(`/api/v1/hr/employees/${employeeId}/enroll/`, {
    method: "POST",
    body: form,
  });
}
