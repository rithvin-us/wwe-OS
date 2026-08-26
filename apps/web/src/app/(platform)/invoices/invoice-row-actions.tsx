"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleDollarSign, Download, FileText, Pencil, Send } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { Label } from "@bop/ui/components/label";
import { Textarea } from "@bop/ui/components/textarea";
import { toast } from "sonner";

import {
  invoicePdfUrl,
  invoiceWorkbookUrl,
  type BillingCustomer,
  type Invoice,
} from "@/config/invoices";

import { cancelInvoiceAction, markInvoicePaidAction, markInvoiceSentAction } from "./actions";
import { GenerateInvoiceDialog } from "./generate-invoice-dialog";

export function InvoiceRowActions({
  invoice,
  customers,
}: {
  invoice: Invoice;
  customers: BillingCustomer[];
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const issued = invoice.status === "issued";
  const isPaid = invoice.payment_status === "paid";

  async function runLifecycle(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error("Say why this invoice is being cancelled — it goes on the record.");
      return;
    }
    setBusy(true);
    const result = await cancelInvoiceAction(invoice.id, reason.trim());
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setCancelling(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
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

      {issued && !isPaid ? (
        <>
          {invoice.sent_at ? null : (
            <Button
              size="icon"
              variant="ghost"
              title="Mark as sent"
              disabled={busy}
              onClick={() => runLifecycle(() => markInvoiceSentAction(invoice.id))}
            >
              <Send className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            title="Mark as paid"
            disabled={busy}
            onClick={() => runLifecycle(() => markInvoicePaidAction(invoice.id))}
          >
            <CircleDollarSign className="size-4" />
          </Button>
        </>
      ) : null}

      {issued ? (
        <>
          <GenerateInvoiceDialog
            // Remount when the invoice changes so the form always prefills
            // from the current revision rather than the one it mounted with.
            key={`${invoice.id}-${invoice.revision}`}
            customers={customers}
            invoice={invoice}
            trigger={
              <Button size="icon" variant="ghost" title="Correct this invoice">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <Button
            size="icon"
            variant="ghost"
            title="Cancel this invoice"
            onClick={() => setCancelling(true)}
          >
            <Ban className="size-4" />
          </Button>
        </>
      ) : null}

      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Cancel invoice {invoice.number}?</DialogTitle>
            <DialogDescription>
              The invoice stays in the register and keeps its number — a cancelled bill never gives
              its number back, because the customer has already seen it. The documents already
              issued are left untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={`cancel-reason-${invoice.id}`}>Reason</Label>
            <Textarea
              id={`cancel-reason-${invoice.id}`}
              rows={3}
              placeholder="e.g. Raised against the wrong site"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelling(false)}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={handleCancel}>
              {busy ? "Cancelling…" : "Cancel invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
