"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  XCircle,
} from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { toast } from "sonner";

import {
  INVOICE_STATUS_BADGE_VARIANTS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  TAX_MODE_LABELS,
  formatInvoiceDate,
  formatRupees,
  invoicePdfUrl,
  invoiceWorkbookUrl,
  type BillingCustomer,
  type Invoice,
  type InvoiceStatus,
} from "@/config/invoices";

import { deleteInvoiceAction, updateInvoiceStatusAction } from "./actions";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";

export type FilterTab = "all" | "approved" | "on_hold" | "declined_cancelled";

export function InvoicesSection({
  invoices: initialInvoices,
  customers,
}: {
  invoices: Invoice[];
  customers: BillingCustomer[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Tab Counts
  const countAll = invoices.length;
  const countApproved = invoices.filter(
    (inv) => inv.status === "approved" || inv.status === "issued",
  ).length;
  const countOnHold = invoices.filter((inv) => inv.status === "on_hold").length;
  const countDeclinedCancelled = invoices.filter(
    (inv) => inv.status === "declined" || inv.status === "cancelled",
  ).length;

  // Filtered List
  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === "approved") return inv.status === "approved" || inv.status === "issued";
    if (activeTab === "on_hold") return inv.status === "on_hold";
    if (activeTab === "declined_cancelled")
      return inv.status === "declined" || inv.status === "cancelled";
    return true;
  });

  async function handleStatusChange(id: string, newStatus: InvoiceStatus) {
    setBusyId(id);
    // Optimistic UI update
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: newStatus } : inv)));
    const res = await updateInvoiceStatusAction(id, newStatus);
    setBusyId(null);
    if (res.ok) {
      toast.success(`Invoice status updated to ${INVOICE_STATUS_LABELS[newStatus]}`);
      router.refresh();
    } else {
      toast.error(res.message);
      // Revert if failed
      setInvoices(initialInvoices);
    }
  }

  async function handleDeleteInvoice(id: string, number: string) {
    if (!confirm(`Are you sure you want to permanently delete invoice ${number}?`)) return;
    setBusyId(id);
    const res = await deleteInvoiceAction(id);
    setBusyId(null);
    if (res.ok) {
      toast.success(`Invoice ${number} deleted.`);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="All Invoices"
            count={countAll}
          />
          <TabButton
            active={activeTab === "approved"}
            onClick={() => setActiveTab("approved")}
            label="Approved / Received"
            count={countApproved}
            variant="success"
          />
          <TabButton
            active={activeTab === "on_hold"}
            onClick={() => setActiveTab("on_hold")}
            label="In Hold / Pending"
            count={countOnHold}
            variant="warning"
          />
          <TabButton
            active={activeTab === "declined_cancelled"}
            onClick={() => setActiveTab("declined_cancelled")}
            label="Declined / Cancelled"
            count={countDeclinedCancelled}
            variant="destructive"
          />
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={
            activeTab === "all"
              ? "No invoices yet"
              : `No ${
                  activeTab === "approved"
                    ? "Approved / Received"
                    : activeTab === "on_hold"
                      ? "In Hold / Pending"
                      : "Declined / Cancelled"
                } invoices`
          }
          description="Invoices raised on the platform will appear here matching your selected status filter."
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
                <th className="p-3 text-right font-medium">Actions & Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((invoice) => {
                const statusLabel = INVOICE_STATUS_LABELS[invoice.status] || invoice.status;
                const badgeVariant = INVOICE_STATUS_BADGE_VARIANTS[invoice.status] || "secondary";

                return (
                  <tr
                    key={invoice.id}
                    className={
                      invoice.status === "cancelled" || invoice.status === "declined"
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
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={badgeVariant}>{statusLabel}</Badge>
                        {invoice.cancellation_reason ? (
                          <span className="max-w-48 text-xs text-muted-foreground">
                            {invoice.cancellation_reason}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick Status Control Buttons */}
                        {invoice.status !== "approved" && invoice.status !== "cancelled" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950"
                            title="Mark Approved / Received"
                            disabled={busyId === invoice.id}
                            onClick={() => handleStatusChange(invoice.id, "approved")}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        ) : null}
                        {invoice.status !== "on_hold" && invoice.status !== "cancelled" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
                            title="Put On Hold"
                            disabled={busyId === invoice.id}
                            onClick={() => handleStatusChange(invoice.id, "on_hold")}
                          >
                            <Clock className="size-4" />
                          </Button>
                        ) : null}
                        {invoice.status !== "declined" && invoice.status !== "cancelled" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                            title="Decline / Reject"
                            disabled={busyId === invoice.id}
                            onClick={() => handleStatusChange(invoice.id, "declined")}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        ) : null}

                        {/* Document Links */}
                        {invoice.pdf_url ? (
                          <Button asChild size="icon" variant="ghost" title="Open PDF">
                            <a href={invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
                              <FileText className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        {invoice.download_url ? (
                          <Button asChild size="icon" variant="ghost" title="Download workbook">
                            <a href={invoiceWorkbookUrl(invoice.id)}>
                              <Download className="size-4" />
                            </a>
                          </Button>
                        ) : null}

                        {invoice.status === "issued" ? (
                          <GenerateInvoiceDialog
                            key={`${invoice.id}-${invoice.revision}`}
                            customers={customers}
                            invoice={invoice}
                            trigger={
                              <Button size="icon" variant="ghost" title="Correct this invoice">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                        ) : null}

                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                          title="Delete invoice"
                          disabled={busyId === invoice.id}
                          onClick={() => handleDeleteInvoice(invoice.id, invoice.number)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant?: "default" | "success" | "warning" | "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
          active
            ? variant === "success"
              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
              : variant === "warning"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : variant === "destructive"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
