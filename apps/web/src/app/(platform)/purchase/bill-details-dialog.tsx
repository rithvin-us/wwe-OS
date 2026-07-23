"use client";

import { Check, Download, Edit, FileText, Trash, User, ExternalLink } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteBillAction, markBillPaidAction, updateBillAction } from "@/app/(platform)/purchase/actions";
import type { PurchaseBill } from "@/lib/purchase";

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

interface BillDetailsDialogProps {
  bill: PurchaseBill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillDetailsDialog({ bill, open, onOpenChange }: BillDetailsDialogProps) {
  const [pending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

  // Editable fields
  const [vendorName, setVendorName] = useState(bill?.seller_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(bill?.invoice_number || "");
  const [totalRate, setTotalRate] = useState(bill?.total_rate || "0.00");
  const [gstNumber, setGstNumber] = useState(bill?.gst_number || "");

  if (!bill) return null;

  const confPercent = Math.round(Number(bill.confidence_score) * 100);
  const senderDisplay =
    bill.telegram_username
      ? `@${bill.telegram_username}`
      : bill.telegram_user_id
        ? `Telegram User ID: ${bill.telegram_user_id}`
        : "Manual / Direct Ingestion";

  function handleSaveEdit() {
    startTransition(async () => {
      const result = await updateBillAction(bill!.id, {
        seller_name: vendorName,
        invoice_number: invoiceNumber,
        total_rate: totalRate,
        gst_number: gstNumber,
      });
      if (result.ok) {
        toast.success(result.message);
        setIsEditing(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markBillPaidAction(bill!.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBillAction(bill!.id);
      if (result.ok) {
        toast.success(result.message);
        setDeletePopoverOpen(false);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  const isPdf =
    bill.document_url?.toLowerCase().endsWith(".pdf") ||
    bill.document_url?.includes("documents/file");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={bill.status === "processed" ? "success" : "warning"}>
                {bill.status === "processed" ? "Processed" : "Needs Attention"} ({confPercent}%)
              </Badge>
              {bill.is_duplicate && <Badge variant="destructive">Duplicate</Badge>}
              <Badge variant="outline" className="capitalize">
                {bill.source_channel}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={pending}
              >
                <Edit className="size-3.5 mr-1" />
                {isEditing ? "Cancel Edit" : "Edit Record"}
              </Button>

              <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash className="size-3.5 mr-1" />
                    Delete
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">Delete Purchase Record</p>
                    <p className="text-xs text-muted-foreground">
                      Are you sure? This purchase bill record will be permanently deleted.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setDeletePopoverOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={handleDelete}
                      disabled={pending}
                    >
                      Confirm Delete
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogTitle className="font-display text-xl font-bold pt-2">
            {bill.seller_name || "Purchase Record"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Extracted purchase invoice & original document copy.
          </DialogDescription>
        </DialogHeader>

        {/* Edit Form Mode */}
        {isEditing ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Edit Extracted Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendor Name</label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Invoice Number</label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Total Amount (₹)</label>
                <Input value={totalRate} onChange={(e) => setTotalRate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">GST Number</label>
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={handleSaveEdit} disabled={pending} className="mt-2">
              <Check className="size-3.5 mr-1" /> Save Changes
            </Button>
          </div>
        ) : null}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-[11px] font-mono uppercase text-muted-foreground">Grand Total</p>
            <p className="font-display text-lg font-bold text-foreground mt-0.5">
              {formatMoney(bill.total_rate, bill.currency)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase text-muted-foreground">Invoice Date</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {formatDate(bill.invoice_date || bill.purchase_date)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase text-muted-foreground">Invoice #</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {bill.invoice_number || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase text-muted-foreground">GST / Tax ID</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {bill.gst_number || "N/A"}
            </p>
          </div>
        </div>

        {/* Sender & Payment Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-card">
            <User className="size-4 text-muted-foreground shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                Document Sender
              </span>
              <span className="font-medium text-foreground">{senderDisplay}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-card">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">
                Payment Status
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant={bill.payment_status === "paid" ? "success" : "secondary"}>
                  {bill.payment_status === "paid" ? "Paid" : "Unpaid"}
                </Badge>
                {bill.paid_at && (
                  <span className="text-[11px] text-muted-foreground">{formatDate(bill.paid_at)}</span>
                )}
              </div>
            </div>

            {bill.payment_status !== "paid" && (
              <Button size="sm" variant="outline" onClick={handleMarkPaid} disabled={pending}>
                Mark Paid
              </Button>
            )}
          </div>
        </div>

        {/* Extracted Line Items Table */}
        {bill.items && bill.items.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase text-muted-foreground">
              Extracted Line Items ({bill.items.length})
            </h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Item Description</th>
                    <th className="text-right p-2.5 font-medium">Qty</th>
                    <th className="text-right p-2.5 font-medium">Unit Price</th>
                    <th className="text-right p-2.5 font-medium">Tax</th>
                    <th className="text-right p-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bill.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-foreground">{item.item_name}</td>
                      <td className="p-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-2.5 text-right tabular-nums">
                        {formatMoney(item.unit_price, bill.currency)}
                      </td>
                      <td className="p-2.5 text-right tabular-nums">
                        {formatMoney(item.tax, bill.currency)}
                      </td>
                      <td className="p-2.5 text-right font-semibold tabular-nums">
                        {formatMoney(item.total, bill.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Original Document Copy & Preview Panel */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText className="size-4 text-blue-500" />
              Original Bill Copy & Live Preview
            </div>

            {bill.document_url && (
              <a
                href={bill.document_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <Download className="size-3.5" />
                Open / Download Copy
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-2 overflow-hidden flex items-center justify-center min-h-[280px]">
            {bill.document_url ? (
              isPdf ? (
                <iframe
                  src={bill.document_url}
                  className="w-full h-96 rounded border-0"
                  title="Receipt Document Preview"
                />
              ) : (
                <img
                  src={bill.document_url}
                  alt="Receipt Copy"
                  className="max-h-96 w-auto object-contain rounded shadow-xs"
                />
              )
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No document URL attached to this purchase record.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 flex justify-between sm:justify-between items-center w-full">
          <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                <Trash className="size-3.5 mr-1" /> Delete Bill
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">Delete Purchase Record</p>
                <p className="text-xs text-muted-foreground">
                  Are you sure? This purchase bill record will be permanently deleted.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setDeletePopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={pending}
                >
                  Confirm Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
