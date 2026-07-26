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

export const MOCK_DEPARTMENT_HEADCOUNT: DepartmentHeadcount[] = [
  { department: "Production", headcount: 24, attendanceRate: 96, otHours: 42 },
  { department: "Maintenance", headcount: 12, attendanceRate: 98, otHours: 28 },
  { department: "Quality Control", headcount: 8, attendanceRate: 94, otHours: 12 },
  { department: "Administration", headcount: 6, attendanceRate: 100, otHours: 3 },
];

export const MOCK_OVERTIME_BY_DEPT: OvertimeByDept[] = [
  { department: "Production", hours: 42 },
  { department: "Maintenance", hours: 28 },
  { department: "Quality Control", hours: 12 },
  { department: "Admin", hours: 3 },
];

export const MOCK_PAYROLL_COST_BREAKDOWN: PayrollCostPoint[] = [
  { category: "Basic Wage", amount: 480000, color: "var(--chart-1)" },
  { category: "Dearness Allowance", amount: 120000, color: "var(--chart-2)" },
  { category: "Overtime Pay", amount: 45000, color: "var(--chart-3)" },
  { category: "Statutory Deductions", amount: 62000, color: "var(--chart-5)" },
];
