/**
 * Dashboard chart shapes. The data is intentionally EMPTY.
 *
 * These arrays used to carry invented revenue, spend, and attendance
 * figures that rendered as real charts on the executive dashboard. A
 * number on that screen is something the operator makes decisions from,
 * so an invented one is worse than no chart at all. Charts fed from here
 * now render their empty state until a real source fills them.
 *
 * The interfaces stay: they are the contract a backend fills.
 */

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

export const MOCK_FINANCIAL_TREND: MonthlyFinancialPoint[] = [];

export const MOCK_SPEND_TREND: SpendTrendPoint[] = [];

export const MOCK_ATTENDANCE_TREND: AttendanceTrendPoint[] = [];

export const MOCK_CATEGORY_BREAKDOWN: CategoryBreakdownPoint[] = [];

export const MOCK_PROCESS_FUNNEL: ProcessFunnelStep[] = [];
