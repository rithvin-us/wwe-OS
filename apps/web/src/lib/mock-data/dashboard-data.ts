export interface MonthlyFinancialPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface SpendTrendPoint {
  month: string;
  spend: number;
  billsCount: number;
}

export interface AttendanceTrendPoint {
  month: string;
  attendanceRate: number;
  otHours: number;
}

export interface CategoryBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

export interface ProcessFunnelStep {
  step: string;
  count: number;
  percentage: number;
}

export const MOCK_FINANCIAL_TREND: MonthlyFinancialPoint[] = [
  { month: "Feb", revenue: 145000, expenses: 42000, net: 103000 },
  { month: "Mar", revenue: 168000, expenses: 68000, net: 100000 },
  { month: "Apr", revenue: 152000, expenses: 55000, net: 97000 },
  { month: "May", revenue: 195000, expenses: 89000, net: 106000 },
  { month: "Jun", revenue: 182000, expenses: 72000, net: 110000 },
  { month: "Jul", revenue: 215000, expenses: 94500, net: 120500 },
];

export const MOCK_SPEND_TREND: SpendTrendPoint[] = [
  { month: "Feb", spend: 42000, billsCount: 12 },
  { month: "Mar", spend: 68000, billsCount: 18 },
  { month: "Apr", spend: 55000, billsCount: 15 },
  { month: "May", spend: 89000, billsCount: 24 },
  { month: "Jun", spend: 72000, billsCount: 19 },
  { month: "Jul", spend: 94500, billsCount: 28 },
];

export const MOCK_ATTENDANCE_TREND: AttendanceTrendPoint[] = [
  { month: "Feb", attendanceRate: 92, otHours: 45 },
  { month: "Mar", attendanceRate: 95, otHours: 62 },
  { month: "Apr", attendanceRate: 91, otHours: 38 },
  { month: "May", attendanceRate: 96, otHours: 78 },
  { month: "Jun", attendanceRate: 94, otHours: 54 },
  { month: "Jul", attendanceRate: 98, otHours: 85 },
];

export const MOCK_CATEGORY_BREAKDOWN: CategoryBreakdownPoint[] = [
  { name: "Pipes & Fittings", value: 38, color: "var(--chart-1)" },
  { name: "Valves & Controls", value: 25, color: "var(--chart-2)" },
  { name: "Electrical & Motors", value: 18, color: "var(--chart-3)" },
  { name: "Civil & Fabrication", value: 12, color: "var(--chart-4)" },
  { name: "Consumables & Tools", value: 7, color: "var(--chart-5)" },
];

export const MOCK_PROCESS_FUNNEL: ProcessFunnelStep[] = [
  { step: "Documents Uploaded", count: 42, percentage: 100 },
  { step: "OCR Extracted", count: 40, percentage: 95 },
  { step: "Verified & Approved", count: 35, percentage: 83 },
  { step: "Posted to Ledger", count: 30, percentage: 71 },
];
