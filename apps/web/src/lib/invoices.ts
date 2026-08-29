import { djangoFetch } from "@/lib/api/server";
import type {
  BillingCustomer,
  ImportBatch,
  ImportBatchDetail,
  Invoice,
  NextInvoiceNumber,
} from "@/config/invoices";

export type {
  BillingCustomer,
  ImportBatch,
  ImportBatchDetail,
  ImportItem,
  Invoice,
  InvoiceLine,
  InvoicePreview,
  InvoiceType,
  NextInvoiceNumber,
  TaxMode,
} from "@/config/invoices";

export async function getBillingCustomers(): Promise<BillingCustomer[]> {
  try {
    return await djangoFetch<BillingCustomer[]>(
      "/api/v1/finance/customers/?ordering=name&page_size=200",
    );
  } catch {
    return [];
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  try {
    return await djangoFetch<Invoice[]>(
      "/api/v1/finance/invoices/?ordering=-sequence_number&page_size=100",
    );
  } catch {
    return [];
  }
}

export async function getNextInvoiceNumber(): Promise<NextInvoiceNumber | null> {
  try {
    return await djangoFetch<NextInvoiceNumber>("/api/v1/finance/invoices/next-number/");
  } catch {
    return null;
  }
}

/** Revenue aggregates for the Executive Dashboard — issued invoices only,
 * cancelled excluded. `monthly` is the last six months, oldest first. */
export interface InvoiceStats {
  revenue_month: number;
  revenue_total: number;
  outstanding: number;
  invoice_count: number;
  monthly: Array<{ period: string; amount: number; count: number }>;
}

/** `null` means the fetch failed (surfaced as an honest "—" / error state on
 * the dashboard) — distinct from a live zero when no invoices exist yet. */
export async function getInvoiceStats(): Promise<InvoiceStats | null> {
  try {
    return await djangoFetch<InvoiceStats>("/api/v1/finance/invoices/stats/");
  } catch {
    return null;
  }
}

/** Bulk historical-invoice import batches, newest first. Empty on failure. */
export async function getInvoiceImports(): Promise<ImportBatch[]> {
  try {
    return await djangoFetch<ImportBatch[]>(
      "/api/v1/finance/invoice-imports/?ordering=-created_at&page_size=100",
    );
  } catch {
    return [];
  }
}

/** One import batch with its items. `null` when it doesn't exist or the fetch
 * failed — the page renders a not-found rather than a broken grid. */
export async function getInvoiceImport(id: string): Promise<ImportBatchDetail | null> {
  try {
    return await djangoFetch<ImportBatchDetail>(`/api/v1/finance/invoice-imports/${id}/`);
  } catch {
    return null;
  }
}
