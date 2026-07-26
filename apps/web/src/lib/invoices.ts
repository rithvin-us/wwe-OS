import { djangoFetch } from "@/lib/api/server";
import type { BillingCustomer, Invoice, NextInvoiceNumber } from "@/config/invoices";

export type {
  BillingCustomer,
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
