"use client";

import { AlertTriangle, Trash } from "@bop/icons";
import { Button } from "@bop/ui/components/button";

import { formatMoney } from "@/app/(platform)/purchase/format";
import type { PurchaseBill } from "@/lib/purchase";

/**
 * The one delete-confirmation pattern for a purchase bill — same copy, same
 * icon, same button order everywhere it's asked. Renders just the warning
 * content, not a container: used inside a Dialog for the row-level delete
 * (bills-table.tsx) and inline inside the already-open Bill Details Dialog
 * (bill-details-dialog.tsx), since stacking a second modal there would be
 * worse UX than the container difference this creates.
 */
export function DeleteBillWarning({
  bill,
  pending,
  onConfirm,
  onCancel,
}: {
  bill: PurchaseBill;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        Delete this purchase record?
      </div>
      <p className="text-xs text-muted-foreground">
        This will permanently remove the digitized purchase record for{" "}
        <strong className="text-foreground">{bill.seller_name}</strong> (
        {formatMoney(bill.total_rate, bill.currency)}). This action cannot be undone.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={pending}>
          <Trash aria-hidden className="size-3.5 mr-1.5" />
          Delete permanently
        </Button>
      </div>
    </div>
  );
}
