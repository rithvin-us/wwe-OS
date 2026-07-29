import { djangoFetch } from "@/lib/api/server";
import type {
  AnomalyReport,
  AttendanceGrid,
  ClaimStatus,
  Employee,
  EmployeeTask,
  ExpenseClaim,
  GenerationLog,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PayrollSummary,
  TrendPoint,
  WorkforceSummary,
} from "@/lib/hr-constants";

/**
 * HR data access. Mirrors `modules/hr/backend` — the migrated HR module
 * (see docs/specs/hr-migration.md). Server-only, like every other lib/* here:
 * the browser never talks to Django directly, so client components import
 * types and constants from ./hr-constants instead of this file.
 */

export * from "@/lib/hr-constants";

// ---------------------------------------------------------------- employees

export async function getEmployees(params?: {
  search?: string;
  status?: string;
}): Promise<Employee[]> {
  const query = new URLSearchParams({ page_size: "200" });
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  return djangoFetch<Employee[]>(`/api/v1/hr/employees/?${query}`);
}

export async function getEmployee(id: string): Promise<Employee> {
  return djangoFetch<Employee>(`/api/v1/hr/employees/${id}/`);
}

// --------------------------------------------------------------- attendance

export async function getAttendanceGrid(year: number, month: number): Promise<AttendanceGrid> {
  return djangoFetch<AttendanceGrid>(`/api/v1/hr/attendance/?year=${year}&month=${month}`);
}

// ------------------------------------------------------------------ payroll

export async function getPayroll(year: number, month: number): Promise<PayrollSummary> {
  return djangoFetch<PayrollSummary>(`/api/v1/hr/payroll/?year=${year}&month=${month}`);
}

// ---------------------------------------------------------------- registers

export async function getRegisters(): Promise<GenerationLog[]> {
  return djangoFetch<GenerationLog[]>(`/api/v1/hr/registers/?page_size=100`);
}

// -------------------------------------------------------------------- leave

export async function getLeaveTypes(): Promise<LeaveType[]> {
  return djangoFetch<LeaveType[]>(`/api/v1/hr/leave/types/?page_size=100`);
}

export async function getLeaveRequests(status?: LeaveStatus): Promise<LeaveRequest[]> {
  const query = new URLSearchParams({ page_size: "200" });
  if (status) query.set("status", status);
  return djangoFetch<LeaveRequest[]>(`/api/v1/hr/leave/requests/?${query}`);
}

export async function getLeaveBalances(year: number): Promise<LeaveBalance[]> {
  return djangoFetch<LeaveBalance[]>(`/api/v1/hr/leave/balances/?year=${year}`);
}

// ----------------------------------------------------------------- expenses

export async function getExpenseClaims(status?: ClaimStatus): Promise<ExpenseClaim[]> {
  const query = new URLSearchParams({ page_size: "200" });
  if (status) query.set("status", status);
  return djangoFetch<ExpenseClaim[]>(`/api/v1/hr/expenses/?${query}`);
}

// ---------------------------------------------------------------- deductions

export async function getDeductions(
  year?: number,
  month?: number,
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams({ page_size: "200" });
  if (year) query.set("year", year.toString());
  if (month) query.set("month", month.toString());
  return djangoFetch<Record<string, unknown>[]>(`/api/v1/hr/deductions/?${query}`);
}

// ---------------------------------------------------------------- checklists

export async function getEmployeeTasks(params?: {
  employee?: string;
  status?: string;
}): Promise<EmployeeTask[]> {
  const query = new URLSearchParams({ page_size: "200" });
  if (params?.employee) query.set("employee", params.employee);
  if (params?.status) query.set("status", params.status);
  return djangoFetch<EmployeeTask[]>(`/api/v1/hr/checklists/tasks/?${query}`);
}

// ---------------------------------------------------------------- analytics

export async function getWorkforceSummary(year: number, month: number): Promise<WorkforceSummary> {
  return djangoFetch<WorkforceSummary>(`/api/v1/hr/analytics/summary/?year=${year}&month=${month}`);
}

export async function getAnomalies(year: number, month: number): Promise<AnomalyReport> {
  return djangoFetch<AnomalyReport>(`/api/v1/hr/analytics/anomalies/?year=${year}&month=${month}`);
}

export async function getAttendanceTrends(
  year: number,
  month: number,
  months = 6,
): Promise<{ points: TrendPoint[] }> {
  return djangoFetch<{ points: TrendPoint[] }>(
    `/api/v1/hr/analytics/trends/?year=${year}&month=${month}&months=${months}`,
  );
}
