"use client";

import { Check, Edit, Eye, FileText, Trash, AlertTriangle } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { Input } from "@bop/ui/components/input";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteBillAction,
  markBillPaidAction,
  updateBillAction,
} from "@/app/(platform)/purchase/actions";
import { BillDetailsDialog } from "@/app/(platform)/purchase/bill-details-dialog";
import type { PurchaseBill } from "@/lib/purchase";
import type { Tag } from "@/lib/tags";

const STATUS_LABEL: Record<PurchaseBill["status"], string> = {
  processed: "Processed",
  needs_attention: "Needs Attention",
};

function StatusBadge({ bill }: { bill: PurchaseBill }) {
  const confPercent = Math.round(Number(bill.confidence_score) * 100);
  if (bill.status === "processed") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="success">{STATUS_LABEL[bill.status]}</Badge>
        <span className="font-mono text-[10px] text-muted-foreground">{confPercent}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="warning">{STATUS_LABEL[bill.status]}</Badge>
      <span className="font-mono text-[10px] text-muted-foreground">{confPercent}%</span>
    </div>
  );
}

function PaymentCell({ bill }: { bill: PurchaseBill }) {
  const [pending, startTransition] = useTransition();

  if (bill.payment_status === "paid") {
    return <Badge variant="success">Paid</Badge>;
  }

  function markPaid(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await markBillPaidAction(bill.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={markPaid} disabled={pending}>
      Mark paid
    </Button>
  );
}

function formatMoney(amount: string | number, currency = "INR") {
  const value = Number(amount);
  if (Number.isNaN(value)) return `₹${amount}`;
  const curr = (currency || "INR").toUpperCase();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: curr === "INR" || curr === "RS" ? "INR" : curr,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RowActions({
  bill,
  onViewDetails,
  onConfirmDelete,
}: {
  bill: PurchaseBill;
  onViewDetails: (bill: PurchaseBill) => void;
  onConfirmDelete: (bill: PurchaseBill) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [vendorName, setVendorName] = useState(bill.seller_name);
  const [invoiceNumber, setInvoiceNumber] = useState(bill.invoice_number);
  const [totalRate, setTotalRate] = useState(bill.total_rate);

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await updateBillAction(bill.id, {
        seller_name: vendorName,
        invoice_number: invoiceNumber,
        total_rate: totalRate,
      });
      if (result.ok) {
        toast.success(result.message);
        setEditOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="secondary" onClick={() => onViewDetails(bill)}>
        <Eye className="size-3.5 mr-1.5" />
        View Details & Preview
      </Button>

      {bill.status === "needs_attention" && (
        <Popover open={editOpen} onOpenChange={setEditOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Edit aria-hidden className="size-3.5 mr-1" />
              Quick Edit
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Review Purchase Record</p>
              <p className="text-xs text-muted-foreground">
                Correct OCR values before finalizing the purchase record.
              </p>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendor Name</label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Invoice Number</label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Total Amount (₹)
                </label>
                <Input value={totalRate} onChange={(e) => setTotalRate(e.target.value)} />
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={handleSave} disabled={pending}>
              <Check aria-hidden className="size-3.5 mr-1" /> Save & Mark Processed
            </Button>
          </PopoverContent>
        </Popover>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive px-2.5"
        onClick={() => onConfirmDelete(bill)}
        title="Delete Bill"
      >
        <Trash className="size-3.5" />
      </Button>
    </div>
  );
}

export function BillsTable({ bills, allTags }: { bills: PurchaseBill[]; allTags: Tag[] }) {
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [billToDelete, setBillToDelete] = useState<PurchaseBill | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleViewDetails(bill: PurchaseBill) {
    setSelectedBill(bill);
    setDetailsOpen(true);
  }

  function handlePromptDelete(bill: PurchaseBill) {
    setBillToDelete(bill);
    setDeleteModalOpen(true);
  }

  function handleExecuteDelete() {
    if (!billToDelete) return;
    startTransition(async () => {
      const result = await deleteBillAction(billToDelete.id);
      if (result.ok) {
        toast.success(result.message);
        setDeleteModalOpen(false);
        setBillToDelete(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  const columns: ColumnDef<PurchaseBill, unknown>[] = [
    {
      accessorKey: "seller_name",
      header: "Vendor",
      cell: ({ row }) => (
        <div
          className="cursor-pointer hover:underline py-1"
          onClick={() => handleViewDetails(row.original)}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground text-sm">{row.original.seller_name}</span>
            {row.original.is_duplicate && (
              <Badge variant="destructive" className="text-[10px]">
                Duplicate
              </Badge>
            )}
          </div>
          {row.original.invoice_number && (
            <p className="font-mono text-[11px] text-muted-foreground">
              Inv: #{row.original.invoice_number}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "purchase_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.purchase_date),
    },
    {
      accessorKey: "total_rate",
      header: "Grand Total",
      cell: ({ row }) => (
        <span className="font-bold tabular-nums text-foreground text-sm">
          {formatMoney(row.original.total_rate, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "source_channel",
      header: "Source & Sender",
      cell: ({ row }) => (
        <div>
          <span className="capitalize text-muted-foreground font-medium block">
            {row.original.source_channel}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {row.original.telegram_username
              ? `@${row.original.telegram_username}`
              : row.original.telegram_user_id
                ? `ID: ${row.original.telegram_user_id}`
                : "Direct Upload"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status & Confidence",
      cell: ({ row }) => <StatusBadge bill={row.original} />,
    },
    {
      accessorKey: "payment_status",
      header: "Payment",
      enableSorting: false,
      cell: ({ row }) => <PaymentCell bill={row.original} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          bill={row.original}
          onViewDetails={handleViewDetails}
          onConfirmDelete={handlePromptDelete}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={bills}
        getRowId={(bill) => bill.id}
        empty={{
          icon: FileText,
          title: "No purchase records yet",
          description:
            "Send a receipt photo or PDF to the Telegram bot — it will be digitized and analyzed automatically.",
        }}
      />

      <BillDetailsDialog
        bill={selectedBill}
        allTags={allTags}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Centered Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md p-6 space-y-4">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold text-lg">
              <AlertTriangle className="size-5 shrink-0" />
              Delete Purchase Record
            </div>
            <DialogTitle className="sr-only">Delete Purchase Record</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the purchase bill for{" "}
              <strong className="text-foreground">{billToDelete?.seller_name}</strong> (
              {billToDelete ? formatMoney(billToDelete.total_rate, billToDelete.currency) : ""})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleExecuteDelete} disabled={pending}>
              <Trash className="size-3.5 mr-1.5" /> Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
