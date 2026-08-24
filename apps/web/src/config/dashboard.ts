import {
  Boxes,
  CircleDollarSign,
  FilePlus2,
  History,
  ShoppingCart,
  Wallet,
  Workflow,
  type LucideIcon,
} from "@bop/icons";
import type { AuditLogEntry } from "@/lib/audit";

export type KpiFormat = "currency" | "count";

/** "live" has a real number. "error" means a wired source's fetch failed
 * just now (worth flagging, unlike calm emptiness). "unwired" means no
 * backend exists for this metric yet — expected, not an error. All three
 * render as "—" without this distinction, which is exactly what hid a real
 * fetch failure behind the same calm copy as "not built yet." */
export type KpiStatus = "live" | "error" | "unwired";

export interface Kpi {
  key: string;
  label: string;
  icon: LucideIcon;
  format: KpiFormat;
  value: number | null;
  deltaPct: number | null;
  source: string;
  status: KpiStatus;
  /** Only set once a KPI is genuinely wired to a live area — an unwired
   * metric has nowhere honest to send the operator, so it stays a plain
   * tile rather than a dead link. */
  href?: string;
}

export interface LivePurchaseStats {
  processed: number;
  needsAttention: number;
  total: number;
  unpaid: number;
}

/** This-month revenue (from invoices) and expenses (from purchase bills).
 * Each is `null` only when its source fetch failed — a live zero (no data
 * yet) stays a real number, so a genuine failure never hides behind "—". */
export interface LiveFinancials {
  revenueMonth: number | null;
  expensesMonth: number | null;
}

/** A wired money metric is "live" when it has a number, "error" when its
 * fetch failed. It is never "unwired" — the backend for it now exists. */
function moneyStatus(value: number | null): KpiStatus {
  return value === null ? "error" : "live";
}

export function buildKpis(
  purchase: LivePurchaseStats | null,
  financials: LiveFinancials | null = null,
): Kpi[] {
  const purchaseFetchFailed = purchase === null;
  const revenueMonth = financials?.revenueMonth ?? null;
  const expensesMonth = financials?.expensesMonth ?? null;

  const kpis: Kpi[] = [
    {
      key: "revenue",
      label: "Revenue (month)",
      icon: CircleDollarSign,
      format: "currency",
      value: revenueMonth,
      deltaPct: null,
      source: "Invoices",
      status: moneyStatus(revenueMonth),
      href: "/invoices",
    },
    {
      key: "expenses",
      label: "Expenses (month)",
      icon: Wallet,
      format: "currency",
      value: expensesMonth,
      deltaPct: null,
      source: "Purchases",
      status: moneyStatus(expensesMonth),
      href: "/purchase",
    },
    {
      key: "digitized-purchases",
      label: "Digitized purchases",
      icon: ShoppingCart,
      format: "count",
      value: purchase?.processed ?? 0,
      deltaPct: null,
      source: "Purchases",
      status: purchaseFetchFailed ? "error" : "live",
      href: "/purchase",
    },
    {
      key: "service-equipment",
      label: "Service equipment",
      icon: Boxes,
      format: "count",
      value: 0,
      deltaPct: null,
      source: "Inventory & Assets",
      status: "unwired",
      href: "/assets",
    },
  ];
  const rank: Record<KpiStatus, number> = { live: 0, error: 1, unwired: 2 };
  return kpis
    .map((kpi, index) => ({ kpi, index }))
    .sort((a, b) => rank[a.kpi.status] - rank[b.kpi.status] || a.index - b.index)
    .map(({ kpi }) => kpi);
}

export interface SummaryRow {
  label: string;
  value: number | null;
  format: KpiFormat;
}

/** Live monthly financials. `Net` needs both halves, so it blanks if either
 * is missing. `Outstanding` is issued-but-unpaid invoice value from the
 * finance stats endpoint — a real receivables figure, in place of the old
 * "Cash position" row that had no data source. */
export function financialSummary(
  financials: LiveFinancials | null,
  outstanding: number | null = null,
): SummaryRow[] {
  const revenue = financials?.revenueMonth ?? null;
  const expenses = financials?.expensesMonth ?? null;
  const net = revenue !== null && expenses !== null ? revenue - expenses : null;
  return [
    { label: "Revenue (month)", value: revenue, format: "currency" },
    { label: "Expenses (month)", value: expenses, format: "currency" },
    { label: "Net (month)", value: net, format: "currency" },
    { label: "Outstanding", value: outstanding, format: "currency" },
  ];
}

export function procurementSummary(
  purchase: LivePurchaseStats | null,
  telegramRecentCount: number | null = null,
): SummaryRow[] {
  return [
    {
      label: "Processed purchases",
      value: purchase?.processed ?? 0,
      format: "count",
    },
    {
      label: "Needs attention",
      value: purchase?.needsAttention ?? 0,
      format: "count",
    },
    {
      label: "Unpaid purchases",
      value: purchase?.unpaid ?? 0,
      format: "count",
    },
    {
      label: "Via Telegram (7d)",
      value: telegramRecentCount ?? 0,
      format: "count",
    },
  ];
}

export interface AlertItem {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  area: string;
  href: string;
}

export function operationalAlerts(
  purchase: LivePurchaseStats | null,
  automationDueCount = 0,
  contractsExpiringCount = 0,
): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (purchase !== null && purchase.needsAttention > 0) {
    alerts.push({
      id: "purchase-needs-attention",
      message: `${purchase.needsAttention} purchase document${
        purchase.needsAttention === 1 ? "" : "s"
      } flagged for low OCR confidence`,
      severity: "warning",
      area: "Purchases",
      href: "/purchase",
    });
  }
  if (purchase !== null && purchase.unpaid > 0) {
    alerts.push({
      id: "purchase-unpaid",
      message: `${purchase.unpaid} purchase bill${
        purchase.unpaid === 1 ? "" : "s"
      } awaiting payment`,
      severity: "info",
      area: "Purchases",
      href: "/purchase",
    });
  }
  if (contractsExpiringCount > 0) {
    alerts.push({
      id: "contracts-expiring",
      message: `${contractsExpiringCount} contract${
        contractsExpiringCount === 1 ? "" : "s"
      } expiring within 30 days`,
      severity: "warning",
      area: "Contracts",
      href: "/contracts",
    });
  }
  if (automationDueCount > 0) {
    alerts.push({
      id: "automation-due",
      message: `${automationDueCount} automation rule${
        automationDueCount === 1 ? "" : "s"
      } due to run`,
      severity: "info",
      area: "Automation",
      href: "/automation",
    });
  }
  return alerts;
}

export interface ActivityItem {
  id: string;
  summary: string;
  area: string;
  at: string;
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatRelative(iso: string): string {
  if (!iso) return "recently";
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return RELATIVE_TIME.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_TIME.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_TIME.format(diffDays, "day");
}

const MODULE_LABEL: Record<string, string> = {
  assets: "Assets",
  inventory: "Inventory",
  contracts: "Contracts",
  documents: "Documents",
  purchase: "Purchases",
  notes: "Notes",
};

/** Today's cross-module activity, straight from the audit trail (the same
 * source the Business Timeline reads) — every business module, not just
 * Purchases. */
export function recentActivity(
  entries: AuditLogEntry[],
  describe: (entry: AuditLogEntry) => string,
): ActivityItem[] {
  return entries.map((entry) => ({
    id: entry.id,
    summary: describe(entry),
    area: MODULE_LABEL[entry.module] ?? entry.module,
    at: formatRelative(entry.created_at),
  }));
}

export interface Insight {
  id: string;
  text: string;
}

/** Wraps the AI-generated business summary (or nothing, if the call failed
 * or hasn't run yet) into the dashboard's insight list — an honest empty
 * state rather than a placeholder sentence. */
export function buildAiInsights(summary: string | null): Insight[] {
  return summary ? [{ id: "business-summary", text: summary }] : [];
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Purchase", href: "/purchase", icon: ShoppingCart },
  { label: "Upload Document", href: "/dms", icon: FilePlus2 },
  { label: "Business Timeline", href: "/timeline", icon: History },
  { label: "Automation", href: "/automation", icon: Workflow },
];

// --- Trends -------------------------------------------------------------- //
// Real monthly series from the purchase (spend) and finance (revenue) stats
// endpoints, shaped for the dashboard charts. A missing series (fetch failed)
// yields an empty array, which the charts render as an honest empty state —
// never fabricated points.

export interface MonthlyPoint {
  /** "YYYY-MM". */
  period: string;
  amount: number;
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthLabel(period: string): string {
  const month = Number(period.split("-")[1]);
  return MONTH_ABBR[month - 1] ?? period;
}

/** Current month as "YYYY-MM", to pick this month's figure out of a series. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** This month's amount from a monthly series: a live 0 when the month has no
 * entry, `null` only when the series itself is missing (its fetch failed). */
export function monthlyAmountFor(series: MonthlyPoint[] | null, period: string): number | null {
  if (series === null) return null;
  return series.find((point) => point.period === period)?.amount ?? 0;
}

/** Monthly bill spend, shaped for the "Procurement & Spend" bar chart. */
export function spendTrend(series: MonthlyPoint[] | null): Array<{ month: string; spend: number }> {
  return (series ?? []).map((point) => ({ month: monthLabel(point.period), spend: point.amount }));
}

/** Revenue vs expenses per month, merged across both series by period, for
 * the "Revenue vs Expenses" line chart. */
export function financialTrend(
  revenue: MonthlyPoint[] | null,
  expenses: MonthlyPoint[] | null,
): Array<{ month: string; revenue: number; expenses: number }> {
  const rev = new Map((revenue ?? []).map((point) => [point.period, point.amount]));
  const exp = new Map((expenses ?? []).map((point) => [point.period, point.amount]));
  const periods = Array.from(new Set([...rev.keys(), ...exp.keys()])).sort();
  return periods.map((period) => ({
    month: monthLabel(period),
    revenue: rev.get(period) ?? 0,
    expenses: exp.get(period) ?? 0,
  }));
}

/** One month of the HR attendance-trend series (a subset of the API's
 * TrendPoint) — enough to plot the rate and tell "no data" from a real 0%. */
export interface AttendanceTrendPoint {
  label: string;
  attendance_pct: number;
  working_units: number;
}

/** Monthly attendance rate for the "Attendance" area chart. A window with no
 * attendance recorded at all (every month's working_units is 0) returns []
 * — an honest empty state, not a misleading flat 0% line. */
export function attendanceTrend(
  points: AttendanceTrendPoint[] | null,
): Array<{ month: string; attendanceRate: number }> {
  if (!points || points.every((point) => point.working_units === 0)) return [];
  return points.map((point) => ({
    month: point.label.split(" ")[0],
    attendanceRate: point.attendance_pct,
  }));
}

/** One entry of the purchase spend-by-item breakdown (a subset of purchase
 * insights' top_materials / vendor_analysis rows). */
export interface SpendSlice {
  name: string;
  total_spend: number;
}

/** Spend distribution for the procurement donut — real spend per top item,
 * zero-spend entries dropped. Empty input yields an honest empty chart. */
export function categoryBreakdown(
  slices: SpendSlice[] | null,
): Array<{ name: string; value: number }> {
  return (slices ?? [])
    .filter((slice) => slice.total_spend > 0)
    .map((slice) => ({ name: slice.name, value: slice.total_spend }));
}

export function formatValue(value: number | null, format: KpiFormat): string {
  if (value === null) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat().format(value);
}
