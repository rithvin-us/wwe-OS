"use client";

import { Check, Download, Edit, ExternalLink, FileText, Trash, User } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Input } from "@bop/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@bop/ui/components/sheet";
import { TagPicker, type TagPickerChange } from "@bop/ui/components/tag-picker";
import type { TagLike } from "@bop/ui/components/tag-pill";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteBillAction, updateBillAction } from "@/app/(platform)/purchase/actions";
import { DeleteBillWarning } from "@/app/(platform)/purchase/delete-bill-warning";
import { formatDate, formatMoney } from "@/app/(platform)/purchase/format";
import { PaymentAction } from "@/app/(platform)/purchase/payment-action";
import type { PurchaseBill } from "@/lib/purchase";
import { getObjectTagsAction, setObjectTagsAction } from "@/lib/tags-actions";
import type { Tag } from "@/lib/tags";

const TAG_MODULE = "purchase";
const TAG_OBJECT_TYPE = "PurchaseBill";

interface BillDetailsDialogProps {
  bill: PurchaseBill | null;
  allTags: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Review drawer for a single purchase bill — slides in over the bills
 * table rather than replacing it, so the operator never loses their place
 * in the list. Receipt and extracted data sit side by side on wide
 * viewports (the receipt column stays pinned while the data column
 * scrolls) and stack on mobile.
 */
export function BillDetailsDialog({ bill, allTags, open, onOpenChange }: BillDetailsDialogProps) {
  const [pending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tags, setTags] = useState<TagLike[]>([]);
  const [tagsPending, startTagsTransition] = useTransition();

  // Editable fields
  const [vendorName, setVendorName] = useState(bill?.seller_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(bill?.invoice_number || "");
  const [totalRate, setTotalRate] = useState(bill?.total_rate || "0.00");
  const [gstNumber, setGstNumber] = useState(bill?.gst_number || "");

  useEffect(() => {
    if (!open || !bill) return;
    getObjectTagsAction(TAG_MODULE, TAG_OBJECT_TYPE, bill.id).then(setTags);
  }, [open, bill]);

  // Re-sync editable fields and dismiss any leftover edit/delete-confirm
  // mode whenever the drawer opens or the underlying bill data changes
  // (e.g. after a save revalidates and this same bill's record updates) —
  // otherwise the form keeps showing whatever was typed for a previous
  // bill, or a stale confirm-delete banner survives into a different one.
  useEffect(() => {
    if (!open || !bill) return;
    setVendorName(bill.seller_name);
    setInvoiceNumber(bill.invoice_number);
    setTotalRate(bill.total_rate);
    setGstNumber(bill.gst_number);
    setIsEditing(false);
    setConfirmDelete(false);
  }, [open, bill]);

  function handleTagsChange(next: TagPickerChange) {
    if (!bill) return;
    startTagsTransition(async () => {
      const result = await setObjectTagsAction(
        TAG_MODULE,
        TAG_OBJECT_TYPE,
        bill.id,
        next.tagIds,
        next.tagNames,
        "/purchase",
      );
      if (result.ok) setTags(result.tags);
      else toast.error(result.message);
    });
  }

  if (!bill) return null;

  const confPercent = Math.round(Number(bill.confidence_score) * 100);
  const senderDisplay = bill.telegram_username
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-3xl lg:max-w-5xl">
        <SheetHeader className="gap-2 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={bill.status === "processed" ? "success" : "warning"}>
                {bill.status === "processed" ? "Processed" : "Needs Attention"} ({confPercent}%)
              </Badge>
              {bill.is_duplicate && <Badge variant="destructive">Duplicate Flagged</Badge>}
              <Badge variant="outline" className="text-xs capitalize">
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
                <Edit className="mr-1.5 size-3.5" />
                {isEditing ? "Cancel Edit" : "Edit Record"}
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete(!confirmDelete)}
                disabled={pending}
              >
                <Trash className="mr-1.5 size-3.5" />
                Delete
              </Button>
            </div>
          </div>

          <SheetTitle className="pt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            {bill.seller_name || "Purchase Record"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Digitized purchase details & document preview.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 lg:items-start">
            {/* Receipt column — pinned on desktop so it stays visible while the data column scrolls */}
            <div className="space-y-3 lg:sticky lg:top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="size-4 text-blue-500" />
                  Original Document Copy
                </div>

                {bill.document_url && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`/api/purchase/bills/${bill.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        Open
                      </a>
                    </Button>
                    <Button size="sm" asChild>
                      <a href={`/api/purchase/bills/${bill.id}/file`} download>
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card/40 p-2">
                {bill.document_url ? (
                  isImage ? (
                    <img
                      src={`/api/purchase/bills/${bill.id}/file`}
                      alt="Receipt Copy"
                      className="max-h-[70vh] w-auto rounded-lg border border-border object-contain shadow-sm"
                    />
                  ) : (
                    <iframe
                      src={`/api/purchase/bills/${bill.id}/file`}
                      title="Document Preview"
                      className="h-[70vh] w-full rounded-lg border border-border bg-background"
                    />
                  )
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No document URL attached to this purchase record.
                  </div>
                )}
              </div>
            </div>

            {/* Extracted data column */}
            <div className="space-y-6">
              <TagPicker
                tags={tags}
                allTags={allTags}
                onChange={handleTagsChange}
                disabled={tagsPending}
              />

              {confirmDelete && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <DeleteBillWarning
                    bill={bill}
                    pending={pending}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(false)}
                  />
                </div>
              )}

              {/* Edit Form Mode */}
              {isEditing && (
                <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Edit className="size-4 text-primary" /> Edit Extracted Details
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Vendor Name
                      </label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Invoice Number
                      </label>
                      <Input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Total Amount (₹)
                      </label>
                      <Input value={totalRate} onChange={(e) => setTotalRate(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        GST Number
                      </label>
                      <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveEdit} disabled={pending}>
                      <Check className="mr-1.5 size-3.5" /> Save & Mark Processed
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Key Financial & Metadata Tiles */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-card/60 p-4">
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    Grand Total
                  </p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums text-foreground">
                    {formatMoney(bill.total_rate, bill.currency)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    Invoice Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatDate(bill.invoice_date || bill.purchase_date)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    Invoice Number
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {bill.invoice_number || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    GST Number
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {bill.gst_number || "—"}
                  </p>
                </div>
              </div>

              {/* Sender & Payment */}
              <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div>
                    <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Document Sender
                    </span>
                    <span className="text-sm font-semibold text-foreground">{senderDisplay}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5">
                  <div>
                    <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      Payment Status
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={bill.payment_status === "paid" ? "success" : "secondary"}>
                        {bill.payment_status === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                      {bill.paid_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(bill.paid_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <PaymentAction billId={bill.id} isPaid={bill.payment_status === "paid"} />
                </div>
              </div>

              {/* Extracted Line Items */}
              {bill.items && bill.items.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                    Extracted Line Items ({bill.items.length})
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="p-2.5 text-left font-medium text-muted-foreground">
                            Item Description
                          </th>
                          <th className="p-2.5 text-right font-medium text-muted-foreground">
                            Qty
                          </th>
                          <th className="p-2.5 text-right font-medium text-muted-foreground">
                            Unit Price
                          </th>
                          <th className="p-2.5 text-right font-medium text-muted-foreground">
                            Tax
                          </th>
                          <th className="p-2.5 text-right font-medium text-muted-foreground">
                            Total
                          </th>
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
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t border-border">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash className="mr-1.5 size-3.5" /> Delete Bill
          </Button>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
