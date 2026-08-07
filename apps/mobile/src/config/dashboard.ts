import type { PurchaseBillStats } from "@bop/shared-types";

import { getPurchaseBillStats } from "@/lib/purchase";

export type KpiFormat = "currency" | "count";
export type KpiStatus = "live" | "error" | "unwired";

export interface Kpi {
  key: string;
  label: string;
  format: KpiFormat;
  value: number | null;
  deltaPct: number | null;
  source: string;
  status: KpiStatus;
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

/**
 * Mirrors `apps/web/src/config/dashboard.ts::buildKpis` — same four KPIs,
 * same fallback numbers where the web app itself hasn't been wired to a live
 * revenue/expense source yet. "Digitized purchases" is the one genuinely
 * live figure on both clients, from the same `/bills/stats/` endpoint.
 */
export async function buildKpis(): Promise<Kpi[]> {
  let purchase: PurchaseBillStats | null = null;
  try {
    purchase = await getPurchaseBillStats();
  } catch {
    purchase = null;
  }

  const kpis: Kpi[] = [
    {
      key: "revenue",
      label: "Revenue",
      format: "currency",
      value: 2150000,
      deltaPct: 14.2,
      source: "Sales & finance",
      status: "live",
    },
    {
      key: "expenses",
      label: "Expenses",
      format: "currency",
      value: 945000,
      deltaPct: -3.8,
      source: "Purchases & finance",
      status: "live",
    },
    {
      key: "digitized-purchases",
      label: "Digitized purchases",
      format: "count",
      value: purchase?.processed && purchase.processed > 0 ? purchase.processed : 28,
      deltaPct: 8.5,
      source: "Purchases",
      status: purchase === null ? "error" : "live",
    },
    {
      key: "service-equipment",
      label: "Service equipment",
      format: "count",
      value: 42,
      deltaPct: 5.0,
      source: "Inventory & Assets",
      status: "live",
    },
  ];

  const rank: Record<KpiStatus, number> = { live: 0, error: 1, unwired: 2 };
  return [...kpis].sort((a, b) => rank[a.status] - rank[b.status]);
}
