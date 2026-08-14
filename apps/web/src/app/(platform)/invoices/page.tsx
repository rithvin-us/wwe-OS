import type { Metadata } from "next";
import { FileSpreadsheet } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";

import {
  INVOICE_TYPE_LABELS,
  LIFECYCLE_BADGE_VARIANT,
  LIFECYCLE_LABELS,
  TAX_MODE_LABELS,
  formatInvoiceDate,
  formatRupees,
} from "@/config/invoices";
import { getBillingCustomers, getInvoices, getNextInvoiceNumber } from "@/lib/invoices";

import { CustomersSection } from "./customers-section";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";
import { InvoiceRowActions } from "./invoice-row-actions";

export const metadata: Metadata = {
  title: "Invoices",
};

export default async function InvoicesPage() {
  const [invoices, customers, nextNumber] = await Promise.all([
    getInvoices(),
    getBillingCustomers(),
    getNextInvoiceNumber(),
  ]);

  const financialYear = nextNumber?.financial_year ?? "";
  const thisYear = financialYear
    ? invoices.filter((invoice) => invoice.financial_year === financialYear)
    : invoices;
  const billed = thisYear.reduce(
    (total, invoice) => total + Number.parseFloat(invoice.total || "0"),
    0,
  );
  const amcCount = thisYear.filter((invoice) => invoice.invoice_type === "amc").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Every AMC and sales invoice raised on the company format, in one shared numbering sequence, with the workbook each one produced."
        actions={<GenerateInvoiceDialog customers={customers} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={financialYear ? `Billed in ${financialYear}` : "Billed"}
          value={thisYear.length > 0 ? formatRupees(billed) : "—"}
          hint={
            thisYear.length > 0
              ? `${thisYear.length} invoice${thisYear.length === 1 ? "" : "s"} · ${amcCount} AMC, ${thisYear.length - amcCount} sales`
              : "No invoices raised yet."
          }
        />
        <SummaryCard
          label="Next bill number"
          value={nextNumber?.number ?? "—"}
          hint="Shared by AMC and sales — taken only when an invoice is generated."
        />
        <SummaryCard
          label="Customers & sites"
          value={customers.length > 0 ? String(customers.length) : "—"}
          hint={`${customers.filter((customer) => customer.is_sez).length} marked SEZ, billed under IGST.`}
        />
      </div>

      <CustomersSection customers={customers} />

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Invoices raised
        </h2>
        {invoices.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No invoices yet"
            description="Generate an AMC or sales invoice and it appears here with its number, its figures, and the workbook it produced."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  <th className="p-3 font-medium">Number</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Consignee</th>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Tax</th>
                  <th className="p-3 text-right font-medium">Total</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={
                      invoice.status === "cancelled"
                        ? "text-muted-foreground transition-colors hover:bg-accent"
                        : "transition-colors hover:bg-accent"
                    }
                  >
                    <td className="p-3 font-mono font-medium text-foreground">
                      {invoice.number}
                      {invoice.revision > 1 ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Revision {invoice.revision}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {INVOICE_TYPE_LABELS[invoice.invoice_type]}
                      {invoice.period_text ? (
                        <span className="block text-xs">{invoice.period_text}</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-foreground">
                      {invoice.consignee_name}
                      {invoice.facility ? (
                        <span className="block text-xs text-muted-foreground">
                          {invoice.facility}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {formatInvoiceDate(invoice.invoice_date)}
                    </td>
                    <td className="p-3">
                      <Badge variant={invoice.is_sez ? "warning" : "secondary"}>
                        {TAX_MODE_LABELS[invoice.tax_mode]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-foreground">
                      {formatRupees(invoice.total)}
                    </td>
                    <td className="p-3">
                      {invoice.status === "cancelled" ? (
                        <>
                          <Badge variant="destructive">Cancelled</Badge>
                          {invoice.cancellation_reason ? (
                            <span className="mt-0.5 block max-w-48 text-xs text-muted-foreground">
                              {invoice.cancellation_reason}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Badge variant={LIFECYCLE_BADGE_VARIANT[invoice.lifecycle_stage]}>
                            {LIFECYCLE_LABELS[invoice.lifecycle_stage]}
                          </Badge>
                          {invoice.due_date && invoice.lifecycle_stage !== "paid" ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              Due {formatInvoiceDate(invoice.due_date)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <InvoiceRowActions invoice={invoice} customers={customers} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
