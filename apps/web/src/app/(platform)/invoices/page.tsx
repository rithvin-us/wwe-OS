import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { formatRupees } from "@/config/invoices";
import { getBillingCustomers, getInvoices, getNextInvoiceNumber } from "@/lib/invoices";

import { BulkImportDialog } from "./bulk-import-dialog";
import { CustomersSection } from "./customers-section";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";
import { InvoicesSection } from "./invoices-section";
import { UploadPoDialog } from "./upload-po-dialog";

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

  // Financial Calculations
  const validInvoices = thisYear.filter(
    (inv) => inv.status !== "cancelled" && inv.status !== "declined",
  );

  const billedTotal = validInvoices.reduce(
    (total, invoice) => total + Number.parseFloat(invoice.total || "0"),
    0,
  );

  const approvedInvoices = validInvoices.filter(
    (inv) => inv.status === "approved" || inv.status === "issued",
  );

  const amountReceived = approvedInvoices.reduce(
    (total, invoice) => total + Number.parseFloat(invoice.total || "0"),
    0,
  );

  const onHoldInvoices = validInvoices.filter((inv) => inv.status === "on_hold");

  const amountToBeReceived = onHoldInvoices.reduce(
    (total, invoice) => total + Number.parseFloat(invoice.total || "0"),
    0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Invoices"
        description="Every AMC and sales invoice raised on the company format, in one shared numbering sequence, with the workbook each one produced."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BulkImportDialog />
            <UploadPoDialog customers={customers} />
            <GenerateInvoiceDialog customers={customers} />
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={financialYear ? `Billed in ${financialYear}` : "Billed"}
          value={thisYear.length > 0 ? formatRupees(billedTotal) : "—"}
          hint={
            thisYear.length > 0
              ? `${thisYear.length} invoice${thisYear.length === 1 ? "" : "s"} raised`
              : "No invoices raised yet."
          }
        />
        <SummaryCard
          label="Amount Received"
          value={approvedInvoices.length > 0 ? formatRupees(amountReceived) : "—"}
          hint={`${approvedInvoices.length} approved / received invoice${approvedInvoices.length === 1 ? "" : "s"}`}
          highlight="success"
        />
        <SummaryCard
          label="Amount to be Received"
          value={amountToBeReceived > 0 ? formatRupees(amountToBeReceived) : "—"}
          hint={
            amountToBeReceived > 0
              ? `${onHoldInvoices.length} invoice${onHoldInvoices.length === 1 ? "" : "s"} in hold / pending`
              : "No pending or held invoices."
          }
          highlight="warning"
        />
        <SummaryCard
          label="Next bill number"
          value={nextNumber?.number ?? "—"}
          hint={`Shared sequence · ${customers.length} billing customer${customers.length === 1 ? "" : "s"}`}
        />
      </div>

      <CustomersSection customers={customers} />

      <InvoicesSection invoices={invoices} customers={customers} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tracking-tight ${
          highlight === "success"
            ? "text-blue-600 dark:text-blue-400"
            : highlight === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
