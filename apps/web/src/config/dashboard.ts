import {
  Boxes,
  CircleDollarSign,
  FilePlus2,
  FileSignature,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "@bop/icons";

/**
 * Executive dashboard data contract — the single place a backend fills to
 * light up the company command center. Every figure resolves from a real
 * business area; until that area starts being used, counts read 0 (a true
 * empty count) and monetary figures read as "not yet available" (unknown,
 * never invented). No fabricated numbers anywhere.
 *
 * When APIs land, replace the constant values below with live queries; the
 * dashboard UI does not change.
 */

export type KpiFormat = "currency" | "count";

export interface Kpi {
  key: string;
  label: string;
  icon: LucideIcon;
  format: KpiFormat;
  /** Live value, or null when the source area has no figure yet. */
  value: number | null;
  /** Period-over-period change in percent, or null when there's no history. */
  deltaPct: number | null;
  /** Plain line naming where the number comes from. */
  source: string;
}

export const KPIS: Kpi[] = [
  {
    key: "revenue",
    label: "Revenue",
    icon: CircleDollarSign,
    format: "currency",
    value: null,
    deltaPct: null,
    source: "Sales & finance",
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: Wallet,
    format: "currency",
    value: null,
    deltaPct: null,
    source: "Purchases & finance",
  },
  {
    key: "pending-approvals",
    label: "Pending approvals",
    icon: FileSignature,
    format: "count",
    value: 0,
    deltaPct: null,
    source: "Across the company",
  },
  {
    key: "employees",
    label: "Employees",
    icon: Users,
    format: "count",
    value: 0,
    deltaPct: null,
    source: "HR",
  },
  {
    key: "open-po",
    label: "Open purchase orders",
    icon: ShoppingCart,
    format: "count",
    value: 0,
    deltaPct: null,
    source: "Purchases",
  },
  {
    key: "low-stock",
    label: "Low-stock items",
    icon: Boxes,
    format: "count",
    value: 0,
    deltaPct: null,
    source: "Inventory",
  },
];

/** A row in a summary panel (financials, people, inventory, procurement…). */
export interface SummaryRow {
  label: string;
  value: number | null;
  format: KpiFormat;
}

export const FINANCIAL_SUMMARY: SummaryRow[] = [
  { label: "Revenue (month)", value: null, format: "currency" },
  { label: "Expenses (month)", value: null, format: "currency" },
  { label: "Net", value: null, format: "currency" },
  { label: "Cash position", value: null, format: "currency" },
];

export const PEOPLE_SUMMARY: SummaryRow[] = [
  { label: "Total employees", value: 0, format: "count" },
  { label: "On leave today", value: 0, format: "count" },
  { label: "Joining this month", value: 0, format: "count" },
];

export const INVENTORY_SUMMARY: SummaryRow[] = [
  { label: "Items tracked", value: 0, format: "count" },
  { label: "Below reorder point", value: 0, format: "count" },
  { label: "Out of stock", value: 0, format: "count" },
];

export const PROCUREMENT_SUMMARY: SummaryRow[] = [
  { label: "Open purchase orders", value: 0, format: "count" },
  { label: "Awaiting approval", value: 0, format: "count" },
  { label: "Awaiting delivery", value: 0, format: "count" },
];

export const CONTRACTS_SUMMARY: SummaryRow[] = [
  { label: "Active contracts", value: 0, format: "count" },
  { label: "Expiring in 30 days", value: 0, format: "count" },
  { label: "Awaiting signature", value: 0, format: "count" },
];

/** Live lists — empty until the relevant area is in use. */
export interface ApprovalItem {
  id: string;
  title: string;
  requestedBy: string;
  area: string;
}
export const PENDING_APPROVALS: ApprovalItem[] = [];

export interface AlertItem {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  area: string;
}
export const OPERATIONAL_ALERTS: AlertItem[] = [];

export interface ActivityItem {
  id: string;
  summary: string;
  area: string;
  at: string;
}
export const RECENT_ACTIVITY: ActivityItem[] = [];

export interface Insight {
  id: string;
  text: string;
}
export const AI_INSIGHTS: Insight[] = [];

/** Quick actions — real navigation into the areas people act in most. */
export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add employee", href: "/hr", icon: UserPlus },
  { label: "New purchase", href: "/purchase", icon: ShoppingCart },
  { label: "Upload document", href: "/dms", icon: FilePlus2 },
  { label: "New contract", href: "/contracts", icon: FileSignature },
];

/** Format a value for display, or an em dash when it isn't available yet. */
export function formatValue(value: number | null, format: KpiFormat): string {
  if (value === null) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat().format(value);
}
