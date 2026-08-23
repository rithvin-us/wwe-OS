import "server-only";

import type { InvoiceStatus, InvoiceType } from "@/config/invoices";
import { djangoFetch } from "@/lib/api/server";

/**
 * Site 360 — a facility-centric view derived server-side from the bill
 * register (finance's `/sites/` surface). Sites are not a table of their own;
 * a facility name is their identity, so it is carried in the URL as a base64url
 * key (facility names contain spaces and slashes).
 */

export interface SiteListRow {
  name: string;
  invoice_count: number;
  total_invoiced: string;
  last_invoice_date: string | null;
  customers: string[];
  is_sez: boolean;
}

export interface SiteInvoiceRow {
  id: string;
  number: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  status: InvoiceStatus;
  total: string;
  customer: string;
  period_text: string;
}

export interface SiteActivity {
  action: string;
  at: string;
  object_id: string;
  number: string;
}

export interface SiteOverview {
  name: string;
  is_sez: boolean;
  customers: string[];
  financials: {
    total_invoiced: string;
    invoice_count: number;
    active_count: number;
    amc_count: number;
  };
  invoices: SiteInvoiceRow[];
  amc: SiteInvoiceRow[];
  activity: SiteActivity[];
  /** Areas the data model doesn't link to a site yet — stated, not faked. */
  unlinked: string[];
}

export async function getSites(): Promise<SiteListRow[]> {
  return djangoFetch<SiteListRow[]>("/api/v1/finance/sites/");
}

export async function getSiteOverview(name: string): Promise<SiteOverview> {
  return djangoFetch<SiteOverview>(
    `/api/v1/finance/sites/overview/?name=${encodeURIComponent(name)}`,
  );
}

export function encodeSiteKey(name: string): string {
  return Buffer.from(name, "utf8").toString("base64url");
}

export function decodeSiteKey(key: string): string {
  return Buffer.from(key, "base64url").toString("utf8");
}

const UNLINKED_LABELS: Record<string, string> = {
  employees: "Employees",
  documents: "Documents",
  purchases: "Purchases",
  attendance: "Attendance",
};

export function unlinkedLabel(area: string): string {
  return UNLINKED_LABELS[area] ?? area;
}
