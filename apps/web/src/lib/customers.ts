import "server-only";

import type { BillingCustomer, InvoiceStatus, InvoiceType } from "@/config/invoices";
import { djangoFetch } from "@/lib/api/server";

/**
 * Customer 360 — assembled server-side by finance's `/customers/<id>/overview/`
 * endpoint from data that already exists (invoices are a real foreign key;
 * sites are derived from billed facilities; activity comes from the audit
 * trail). The browser never talks to Django directly — this goes through the
 * server-only platform fetch.
 */

export interface CustomerFinancials {
  total_invoiced: string;
  invoice_count: number;
  active_count: number;
  cancelled_count: number;
  amc_count: number;
  sales_count: number;
  /** Payment isn't modelled yet, so this is deliberately null (honest blank). */
  outstanding: string | null;
}

export interface CustomerSite {
  name: string;
  invoice_count: number;
  total_invoiced: string;
  last_invoice_date: string | null;
}

export interface CustomerInvoiceRow {
  id: string;
  number: string;
  invoice_type: InvoiceType;
  invoice_date: string;
  status: InvoiceStatus;
  total: string;
  facility: string;
  period_text: string;
}

export interface CustomerActivity {
  action: string;
  at: string;
  object_id: string;
  number: string;
  changes: Record<string, unknown>;
}

export interface CustomerOverview {
  customer: BillingCustomer;
  financials: CustomerFinancials;
  sites: CustomerSite[];
  invoices: CustomerInvoiceRow[];
  amc: CustomerInvoiceRow[];
  activity: CustomerActivity[];
}

export async function getCustomers(): Promise<BillingCustomer[]> {
  return djangoFetch<BillingCustomer[]>(
    "/api/v1/finance/customers/?ordering=name&page_size=200",
  );
}

export async function getCustomerOverview(id: string): Promise<CustomerOverview> {
  return djangoFetch<CustomerOverview>(`/api/v1/finance/customers/${id}/overview/`);
}

/** Friendly labels for the finance audit actions that show up in activity. */
const ACTIVITY_LABELS: Record<string, string> = {
  "finance.invoice_generated": "Invoice generated",
  "finance.invoice_corrected": "Invoice corrected",
  "finance.invoice_cancelled": "Invoice cancelled",
};

export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replace(/^finance\./, "").replace(/_/g, " ");
}
