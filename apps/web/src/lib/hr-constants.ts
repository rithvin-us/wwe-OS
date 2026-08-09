// Client-safe HR types, constants, and pure helpers. No server-only imports —
// client components import from here; the server fetchers live in ./hr and
// re-export everything below.

// ---------------------------------------------------------------- employees

export type EmployeeStatus = "Active" | "Left" | "New Joining";
export type SkillCategory = "Skilled" | "Semi Skilled" | "Unskilled";
export type ShiftCode = "G" | "M" | "E" | "N";

export interface Employee {
  id: string;
  employee_code: string;
  employee_name: string;
  father_husband_name: string;
  gender: string;
  dob: string | null;
  address: string;
  phone: string;
  designation: string;
  department: string;
  date_of_joining: string;
  date_of_leaving: string | null;
  salary: number;
  pf_number: string;
  uan: string;
  esic_number: string;
  bank_name: string;
  bank_account: string;
  ifsc_code: string;
  status: EmployeeStatus;
  skill_category: SkillCategory;
  location: string;
  shift: ShiftCode;
  enrolled_at: string | null;
  photo_url?: string | null;
  is_active: boolean;
  age: number | null;
  age_gender_display: string;
  created_at: string;
  updated_at: string;
}

// --------------------------------------------------------------- attendance

/**
 * Attendance status codes. These exact strings travel to the backend and are
 * written into the statutory registers — see
 * `modules/hr/backend/models/attendance.py`. Do not rename them.
 */
export const ATTENDANCE_CODES = {
  P: "Present",
  A: "Absent",
  PL: "Paid leave",
  CL: "Casual leave",
  SL: "Sick leave",
  L: "Leave",
  NH: "National holiday",
  WH: "Weekly holiday",
  WO: "Weekly off",
  CO: "Compensatory off",
  HD: "Half day",
  NJ: "Not yet joined",
  LEFT: "Left",
} as const;

export const SHIFT_NAMES: Record<ShiftCode, string> = {
  G: "General",
  M: "Morning",
  E: "Evening",
  N: "Night",
};

export interface AttendanceDay {
  day: number;
  status: string;
  shift: ShiftCode;
  in_time: string;
  out_time: string;
  worked_hours: number | null;
  ot_hours: number | null;
  late_entry: boolean | null;
  early_exit: boolean | null;
}

export interface AttendanceRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  shift: ShiftCode;
  days: Record<string, AttendanceDay>;
}

export interface AttendanceGrid {
  year: number;
  month: number;
  rows: AttendanceRow[];
}

// ------------------------------------------------------------------ payroll

export interface PayrollRow {
  id: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  year: number;
  month: number;
  present_days: number;
  leave_days: number;
  holiday_days: number;
  week_off_days: number;
  total_paid_days: number;
  absent_days: number;
  ot_hours: number;
  basic_earned: number;
  da_earned: number;
  hra_earned: number;
  medical_allowance: number;
  conveyance_allowance: number;
  nfh_wages: number;
  ot_earned: number;
  leave_wages: number;
  gross_salary: number;
  pf_deduction: number;
  esi_deduction: number;
  professional_tax: number;
  lwf: number;
  advance_deduction: number;
  damage_deduction: number;
  other_deductions: number;
  total_deductions: number;
  expense_reimbursement: number;
  net_salary: number;
  generated_at: string;
}

export interface PayrollSummary {
  year: number;
  month: number;
  total_employees: number;
  total_gross: number;
  total_pf: number;
  total_esi: number;
  total_deductions: number;
  total_net: number;
  records: PayrollRow[];
}

// ---------------------------------------------------------------- registers

export interface GenerationLog {
  id: string;
  year: number;
  month: number;
  version: number;
  filename: string;
  file_hash: string;
  status: "generated" | "closed" | "reopened";
  generated_by_name: string;
  generated_at: string;
  closed_at: string | null;
  reopen_reason: string;
  reopened_at: string | null;
}

// -------------------------------------------------------------------- leave

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  default_annual_quota: number;
  is_paid: boolean;
  description: string;
}

export interface LeaveBalance {
  id: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  leave_type: string;
  leave_type_code: string;
  leave_type_name: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  leave_type: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decided_by_name: string;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
}

// ----------------------------------------------------------------- expenses

export type ClaimStatus = "pending" | "approved" | "rejected";

export interface ExpenseClaim {
  id: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string;
  has_receipt: boolean;
  status: ClaimStatus;
  decided_by_name: string;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
}

// --------------------------------------------------------------- checklists

export interface EmployeeTask {
  id: string;
  employee: string;
  employee_code: string;
  employee_name: string;
  title: string;
  description: string;
  department: string;
  workflow: "onboarding" | "offboarding";
  status: "pending" | "completed";
  due_date: string | null;
  completed_at: string | null;
  completed_by_name: string;
  created_at: string;
}

// ---------------------------------------------------------------- analytics

export interface DepartmentStat {
  department: string;
  headcount: number;
  present_units: number;
  working_units: number;
  attendance_pct: number;
  ot_hours: number;
}

export interface ShiftStat {
  shift: ShiftCode;
  name: string;
  present_days: number;
  pct: number;
}

export interface WorkforceSummary {
  year: number;
  month: number;
  total_employees: number;
  active_employees: number;
  left_employees: number;
  new_joiners: number;
  leavers_this_month: number;
  present_units: number;
  absent_days: number;
  leave_days: number;
  holiday_off_days: number;
  working_units: number;
  attendance_pct: number;
  leave_pct: number;
  absent_pct: number;
  total_ot_hours: number;
  avg_ot_per_active: number;
  payroll_generated: number;
  payroll_eligible: number;
  payroll_readiness_pct: number;
  period_locked: boolean;
  departments: DepartmentStat[];
  shifts: ShiftStat[];
  compliance: {
    active: number;
    missing_pf: number;
    missing_esic: number;
    missing_uan: number;
    not_face_enrolled: number;
    compliant_pct: number;
  };
  anomaly_count: number;
}

export interface Anomaly {
  type: string;
  severity: "high" | "medium" | "low";
  detail: string;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  day: number | null;
}

export interface AnomalyReport {
  year: number;
  month: number;
  total: number;
  by_type: Record<string, number>;
  anomalies: Anomaly[];
}

export interface TrendPoint {
  year: number;
  month: number;
  label: string;
  attendance_pct: number;
  present_units: number;
  working_units: number;
  total_ot_hours: number;
  active_employees: number;
}

// ------------------------------------------------------------------- shared

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The month the HR screens default to: the current one. */
export function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Parse ?year=&month= from a page's searchParams, falling back to this month. */
export function periodFromParams(params: { year?: string; month?: string }): {
  year: number;
  month: number;
} {
  const fallback = currentPeriod();
  const year = Number(params.year);
  const month = Number(params.month);
  return {
    year: Number.isFinite(year) && year > 2000 ? year : fallback.year,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : fallback.month,
  };
}
