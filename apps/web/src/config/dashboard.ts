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

export interface Kpi {
  key: string;
  label: string;
  icon: LucideIcon;
  format: KpiFormat;
  value: number | null;
  deltaPct: number | null;
  source: string;
}

export interface LivePurchaseStats {
  processed: number;
  needsAttention: number;
  total: number;
  unpaid: number;
}

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
    {
      key: "digitized-purchases",
      label: "Digitized Purchases",
      icon: ShoppingCart,
      format: "count",
      value: purchase?.processed ?? null,
      deltaPct: null,
      source: "Purchases",
    },
    {
      key: "service-equipment",
      label: "Service equipment",
      icon: Boxes,
      format: "count",
      value: null,
      deltaPct: null,
      source: "Inventory & Assets",
    },
  ];
}

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

export const INVENTORY_SUMMARY: SummaryRow[] = [
  { label: "Service equipment tracked", value: null, format: "count" },
  { label: "Active in service", value: null, format: "count" },
  { label: "Depleted spare parts", value: null, format: "count" },
];

export function procurementSummary(
  purchase: LivePurchaseStats | null,
  telegramRecentCount: number | null = null,
): SummaryRow[] {
  return [
    { label: "Processed purchases", value: purchase?.processed ?? null, format: "count" },
    { label: "Needs attention", value: purchase?.needsAttention ?? null, format: "count" },
    { label: "Unpaid purchases", value: purchase?.unpaid ?? null, format: "count" },
    { label: "Via Telegram (7d)", value: telegramRecentCount, format: "count" },
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

function formatRelative(iso: string): string {
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
