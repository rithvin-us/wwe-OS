"use client";

import { Check, FileText, X } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { Textarea } from "@bop/ui/components/textarea";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  confirmBillAction,
  markBillPaidAction,
  rejectBillAction,
} from "@/app/(platform)/purchase/actions";
import type { PurchaseBill } from "@/lib/purchase";

const STATUS_LABEL: Record<PurchaseBill["status"], string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

function StatusBadge({ status }: { status: PurchaseBill["status"] }) {
  if (status === "confirmed") return <Badge variant="success">{STATUS_LABEL[status]}</Badge>;
  if (status === "rejected") return <Badge variant="destructive">{STATUS_LABEL[status]}</Badge>;
  return <Badge variant="warning">{STATUS_LABEL[status]}</Badge>;
}

function PaymentCell({ bill }: { bill: PurchaseBill }) {
  const [pending, startTransition] = useTransition();

  if (bill.status !== "confirmed") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (bill.payment_status === "paid") {
    return <Badge variant="success">Paid</Badge>;
  }

  function markPaid() {
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

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RowActions({ bill }: { bill: PurchaseBill }) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  if (bill.status !== "pending_review") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmBillAction(bill.id, bill.seller_name);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectBillAction(bill.id, reason);
      if (result.ok) {
        toast.success(result.message);
        setRejectOpen(false);
        setReason("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="secondary" onClick={confirm} disabled={pending}>
        <Check aria-hidden />
        Confirm
      </Button>
      <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" disabled={pending}>
            <X aria-hidden />
            Reject
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Reject this bill</p>
            <p className="text-xs text-muted-foreground">
              Say why — this is kept with the bill for reference.
            </p>
          </div>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate of an earlier bill"
            rows={3}
            autoFocus
          />
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={reject}
            disabled={pending || reason.trim().length === 0}
          >
            Reject bill
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const columns: ColumnDef<PurchaseBill, unknown>[] = [
  {
    accessorKey: "seller_name",
    header: "Seller",
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.seller_name}</span>
    ),
  },
  {
    accessorKey: "purchase_date",
    header: "Date",
    cell: ({ row }) => formatDate(row.original.purchase_date),
  },
  {
    accessorKey: "total_rate",
    header: "Total",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatMoney(row.original.total_rate, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: "source_channel",
    header: "Source",
    cell: ({ row }) => (
      <span className="capitalize text-muted-foreground">{row.original.source_channel}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
    cell: ({ row }) => <RowActions bill={row.original} />,
  },
];

export function BillsTable({ bills }: { bills: PurchaseBill[] }) {
  return (
    <DataTable
      columns={columns}
      data={bills}
      getRowId={(bill) => bill.id}
      empty={{
        icon: FileText,
        title: "No bills yet",
        description:
          "Send a photo or PDF of a purchase bill to the Telegram bot — it will show up here for review.",
      }}
    />
  );
}
