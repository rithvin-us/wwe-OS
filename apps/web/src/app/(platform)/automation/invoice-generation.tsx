import Link from "next/link";
import { FileSpreadsheet } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { GenerateInvoiceDialog } from "@/app/(platform)/invoices/generate-invoice-dialog";
import { formatInvoiceDate, formatRupees } from "@/config/invoices";
import type { BillingCustomer, Invoice, NextInvoiceNumber } from "@/config/invoices";

/**
 * The Automation tab's Invoice Generation entry. Unlike a collection rule it
 * runs on demand rather than on a schedule — invoices are raised when the
 * work is done, not on a timer — so it gets its own card rather than a row in
 * the rules table.
 */
export function InvoiceGeneration({
  customers,
  nextNumber,
  recent,
}: {
  customers: BillingCustomer[];
  nextNumber: NextInvoiceNumber | null;
  recent: Invoice[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-foreground">Invoice generation</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Fills the company invoice format for an AMC or Sales bill, takes the next number from
              the shared bill register, switches to IGST for SEZ sites, and saves the workbook into
              this month&apos;s invoice folder.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {nextNumber ? `Next number · ${nextNumber.number}` : "Bill register not reachable"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/invoices">Bill register</Link>
          </Button>
          <GenerateInvoiceDialog customers={customers} />
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          No customers or sites on file yet — add one in the bill register first, and set whether it
          is an SEZ site so the tax mode is right.
        </p>
      ) : null}

      {recent.length > 0 ? (
        <div className="divide-y divide-border border-t border-border">
          {recent.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-foreground">{invoice.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {invoice.consignee_name} · {formatInvoiceDate(invoice.invoice_date)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-foreground">
                {formatRupees(invoice.total)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
