/**
 * HR chart shapes. The data is intentionally EMPTY — see dashboard-data.ts.
 *
 * Headcount, attendance rates, and payroll cost splits are reported to
 * statutory registers; inventing them is not a cosmetic problem.
 */

export interface DepartmentHeadcount {
  department: string;
  headcount: number;
  attendanceRate: number;
  otHours: number;
}

export interface OvertimeByDept {
  department: string;
  hours: number;
}

export interface PayrollCostPoint {
  category: string;
  amount: number;
  color: string;
}

export const MOCK_DEPARTMENT_HEADCOUNT: DepartmentHeadcount[] = [];

export const MOCK_OVERTIME_BY_DEPT: OvertimeByDept[] = [];

export const MOCK_PAYROLL_COST_BREAKDOWN: PayrollCostPoint[] = [];
