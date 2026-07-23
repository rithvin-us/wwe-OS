"use client";

import {
  Check,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Send,
  Trash,
  User,
  AlertTriangle,
} from "@bop/icons";
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
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        ? `Telegram User (ID: ${bill.telegram_user_id})`
        : "Direct Ingestion / Upload";

  const isImage =
    bill.document_url?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ||
    (bill.raw_extraction && bill.raw_extraction.is_image);

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
        setConfirmDelete(false);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-6 bg-background border-border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={bill.status === "processed" ? "success" : "warning"}>
                {bill.status === "processed" ? "Processed" : "Needs Attention"} ({confPercent}%)
              </Badge>
              {bill.is_duplicate && <Badge variant="destructive">Duplicate Flagged</Badge>}
              <Badge variant="outline" className="capitalize text-xs">
                Source: {bill.source_channel}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={pending}
              >
                <Edit className="size-3.5 mr-1.5" />
                {isEditing ? "Cancel Edit" : "Edit Record"}
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete(!confirmDelete)}
                disabled={pending}
              >
                <Trash className="size-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>

          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground pt-1">
            {bill.seller_name || "Purchase Record"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Digitized purchase details & document preview.
          </DialogDescription>
        </DialogHeader>

        {/* Delete Confirmation Warning Box */}
        {confirmDelete && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              Confirm Permanently Deleting Purchase Bill?
            </div>
            <p className="text-xs text-muted-foreground">
              This will remove the digitized purchase record for {bill.seller_name} ({formatMoney(bill.total_rate, bill.currency)}). This action cannot be undone.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={pending}
              >
                <Trash className="size-3.5 mr-1.5" /> Permanently Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Edit Form Mode */}
        {isEditing && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-sm">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Edit className="size-4 text-primary" /> Edit Extracted Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Vendor Name</label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Invoice Number</label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Total Amount (₹)</label>
                <Input value={totalRate} onChange={(e) => setTotalRate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">GST Number</label>
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSaveEdit} disabled={pending}>
                <Check className="size-3.5 mr-1.5" /> Save & Mark Processed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Key Financial & Metadata Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-border bg-card/60 p-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Grand Total</p>
            <p className="font-display text-xl font-bold text-foreground mt-1 tabular-nums">
              {formatMoney(bill.total_rate, bill.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Invoice Date</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              {formatDate(bill.invoice_date || bill.purchase_date)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Invoice Number</p>
            <p className="text-sm font-semibold text-foreground mt-1 font-mono">
              {bill.invoice_number || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">GST Number</p>
            <p className="text-sm font-semibold text-foreground mt-1 font-mono">
              {bill.gst_number || "N/A"}
            </p>
          </div>
        </div>

        {/* Sender & Payment Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-3 rounded-lg border border-border p-3.5 bg-card">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <User className="size-4" />
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">
                Document Sender
              </span>
              <span className="font-semibold text-foreground text-sm">{senderDisplay}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-card">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">
                Payment Status
              </span>
              <div className="mt-1 flex items-center gap-2">
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
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Extracted Line Items ({bill.items.length})
            </h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Item Description</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Unit Price</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Tax</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bill.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2.5 font-medium text-foreground">{item.item_name}</td>
                      <td className="p-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-2.5 text-right tabular-nums">
                        {formatMoney(item.unit_price, bill.currency)}
                      </td>
                      <td className="p-2.5 text-right tabular-nums">
                        {formatMoney(item.tax, bill.currency)}
                      </td>
                      <td className="p-2.5 text-right font-semibold tabular-nums text-foreground">
                        {formatMoney(item.total, bill.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Non-Auto-Downloading Document Preview Box */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText className="size-4 text-blue-500" />
              Original Document Copy
            </div>

            {bill.document_url && (
              <div className="flex items-center gap-2">
                <a
                  href={bill.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="size-3.5 text-blue-400" />
                  Open Preview in New Tab
                </a>
                <a
                  href={bill.document_url}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="size-3.5" />
                  Download File
                </a>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
            {bill.document_url ? (
              isImage ? (
                <img
                  src={bill.document_url}
                  alt="Receipt Copy"
                  className="max-h-96 w-auto object-contain rounded-lg border border-border shadow-sm"
                />
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="size-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                    <FileText className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Document File Ready</p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      Click below to view the document copy safely without automatic background downloading.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <a
                      href={bill.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <ExternalLink className="size-4" /> View / Preview Document
                    </a>
                    <a
                      href={bill.document_url}
                      download
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                    >
                      <Download className="size-4" /> Download Copy
                    </a>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No document URL attached to this purchase record.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 flex justify-between items-center w-full">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash className="size-3.5 mr-1.5" /> Delete Bill
          </Button>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
