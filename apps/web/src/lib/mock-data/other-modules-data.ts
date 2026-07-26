export interface ReportUsageItem {
  name: string;
  runsCount: number;
  category: string;
}

export interface DmsFileTypeItem {
  type: string;
  count: number;
  color: string;
}

export interface TimelineModulePoint {
  module: string;
  events: number;
}

export interface AutomationRunPoint {
  day: string;
  successful: number;
  failed: number;
}

export const MOCK_REPORT_USAGE: ReportUsageItem[] = [
  { name: "Monthly Payroll Master", runsCount: 42, category: "HR" },
  { name: "GST Input Tax Credit Summary", runsCount: 38, category: "Purchases" },
  { name: "Vendor Spend Ledger", runsCount: 29, category: "Purchases" },
  { name: "Form B Muster Roll", runsCount: 25, category: "HR" },
  { name: "System Audit Logs", runsCount: 14, category: "System" },
];

export const MOCK_DMS_FILE_TYPES: DmsFileTypeItem[] = [
  { type: "Tax Invoices (PDF)", count: 48, color: "var(--chart-1)" },
  { type: "Statutory Registers (XLSX)", count: 24, color: "var(--chart-2)" },
  { type: "Challans & Receipts", count: 18, color: "var(--chart-3)" },
  { type: "Compliance Contracts", count: 12, color: "var(--chart-4)" },
];

export const MOCK_TIMELINE_ACTIVITY: TimelineModulePoint[] = [
  { module: "Purchases", events: 142 },
  { module: "HR & Payroll", events: 98 },
  { module: "DMS", events: 45 },
  { module: "Automation", events: 32 },
  { module: "System Settings", events: 12 },
];

export const MOCK_AUTOMATION_RUNS: AutomationRunPoint[] = [
  { day: "Mon", successful: 14, failed: 0 },
  { day: "Tue", successful: 18, failed: 1 },
  { day: "Wed", successful: 22, failed: 0 },
  { day: "Thu", successful: 16, failed: 0 },
  { day: "Fri", successful: 25, failed: 1 },
  { day: "Sat", successful: 8, failed: 0 },
  { day: "Sun", successful: 5, failed: 0 },
];
