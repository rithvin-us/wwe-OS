import {
  Boxes,
  CircleDollarSign,
  FilePlus2,
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

/**
 * Live purchase figures, when available. `null` means "not fetched yet or
 * the request failed" — every consumer below renders that as an honest
 * blank, never a zero it doesn't actually know.
 */
export interface LivePurchaseStats {
  pendingReview: number;
  confirmed: number;
  rejected: number;
  total: number;
  unpaidConfirmed: number;
  overduePending: number;
}

/**
 * The dashboard's KPI row. Two of the six are backed by real data today
 * (Purchases is the only module with any) — the rest stay honest nulls
 * until their module exists. Built as a function, not a constant, because
 * "pending approvals" and "bills to review" need the live count injected
 * by the page that fetches it.
 */
export function buildKpis(purchase: LivePurchaseStats | null): Kpi[] {
  return [
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
    // Removed pending approvals tile
    {
      key: "employees",
      label: "Employees",
      icon: Users,
      format: "count",
      value: null,
      deltaPct: null,
      source: "HR",
    },
    {
      key: "bills-to-review",
      label: "Bills to review",
      icon: ShoppingCart,
      format: "count",
      value: purchase?.pendingReview ?? null,
      deltaPct: null,
      source: "Purchases",
    },
    {
      key: "low-stock",
      label: "Low-stock items",
      icon: Boxes,
      format: "count",
      value: null,
      deltaPct: null,
      source: "Inventory",
    },
  ];
}

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

// null, not 0 — these are genuinely unknown until HR/Inventory are
// connected. A literal 0 would claim "no employees," which is false.
export const PEOPLE_SUMMARY: SummaryRow[] = [
  { label: "Total employees", value: null, format: "count" },
  { label: "On leave today", value: null, format: "count" },
  { label: "Joining this month", value: null, format: "count" },
];

export const INVENTORY_SUMMARY: SummaryRow[] = [
  { label: "Items tracked", value: null, format: "count" },
  { label: "Below reorder point", value: null, format: "count" },
  { label: "Out of stock", value: null, format: "count" },
];

/** Real, live bill counts — the one summary panel backed by actual data. */
export function procurementSummary(purchase: LivePurchaseStats | null): SummaryRow[] {
  return [
    { label: "Bills pending review", value: purchase?.pendingReview ?? null, format: "count" },
    { label: "Bills confirmed", value: purchase?.confirmed ?? null, format: "count" },
    { label: "Bills rejected", value: purchase?.rejected ?? null, format: "count" },
  ];
}

export const CONTRACTS_SUMMARY: SummaryRow[] = [
  { label: "Active contracts", value: null, format: "count" },
  { label: "Expiring in 30 days", value: null, format: "count" },
  { label: "Awaiting signature", value: null, format: "count" },
];

export interface AlertItem {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  area: string;
}

/** Real alerts derived from live purchase figures — empty until something
 * actually needs attention, never a placeholder list. */
export function operationalAlerts(purchase: LivePurchaseStats | null): AlertItem[] {
  if (purchase === null) return [];
  const alerts: AlertItem[] = [];
  if (purchase.overduePending > 0) {
    alerts.push({
      id: "purchase-overdue-pending",
      message: `${purchase.overduePending} bill${
        purchase.overduePending === 1 ? "" : "s"
      } awaiting review for over 3 days`,
      severity: "warning",
      area: "Purchases",
    });
  }
  if (purchase.unpaidConfirmed > 0) {
    alerts.push({
      id: "purchase-unpaid-confirmed",
      message: `${purchase.unpaidConfirmed} confirmed bill${
        purchase.unpaidConfirmed === 1 ? "" : "s"
      } awaiting payment`,
      severity: "info",
      area: "Purchases",
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

/** Short "2h ago" / "3d ago" label for an ISO timestamp. */
function formatRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return RELATIVE_TIME.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return RELATIVE_TIME.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_TIME.format(diffDays, "day");
}

/** Real recent activity from bills the operator has reviewed. */
export function recentActivity(
  bills: {
    id: string;
    seller_name: string;
    currency: string;
    total_rate: string;
    status: "pending_review" | "confirmed" | "rejected";
    payment_status: "unpaid" | "paid";
    reviewed_at: string | null;
  }[],
): ActivityItem[] {
  return bills
    .filter((bill) => bill.reviewed_at !== null)
    .map((bill) => {
      const amount = `${bill.currency} ${bill.total_rate}`;
      const summary =
        bill.status === "confirmed"
          ? `${bill.seller_name} confirmed — ${amount}${
              bill.payment_status === "paid" ? " (paid)" : ""
            }`
          : `${bill.seller_name} rejected — ${amount}`;
      return {
        id: bill.id,
        summary,
        area: "Purchases",
        at: formatRelative(bill.reviewed_at as string),
      };
    });
}

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
  { label: "New site", href: "/assets/dcs", icon: Boxes },
  // { label: "New contract", href: "/contracts", icon: FileSignature },
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
