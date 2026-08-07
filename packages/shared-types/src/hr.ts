/**
 * Mirrors `apps/web/src/lib/hr-constants.ts` field-for-field (the client-safe
 * HR types apps/web itself was built against) plus the face check-in/enroll
 * contracts from `modules/hr/backend/serializers/checkin.py` directly — those
 * two are typed here against the real Django serializer, not against
 * `apps/web/src/app/(platform)/hr/actions.ts::CheckInResult`, which claims a
 * `matched`/`action` field the wire response doesn't actually have.
 */

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
  is_active: boolean;
  age: number | null;
  age_gender_display: string;
  created_at: string;
  updated_at: string;
}

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

/** POST /api/v1/hr/leave/requests/ — `days` is server-derived, not sent. */
export interface CreateLeaveRequestPayload {
  employee: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

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

/** POST /api/v1/hr/attendance/checkin/ response — CheckInResponseSerializer. */
export interface CheckInResponse {
  recognized: boolean;
  employee_id: string | null;
  employee_name: string | null;
  employee_code: string | null;
  decision: "auto_approved" | "flagged";
  direction: "in" | "out";
  shift: ShiftCode;
  time: string;
  within_geofence: boolean;
  face_score: number;
  confidence: number;
  message: string;
}

/** POST /api/v1/hr/employees/{id}/enroll/ response — EnrollResponseSerializer. */
export interface EnrollResponse {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  enrolled_at: string;
  checkin_path: string;
}

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

export function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
