"use client";

import { Button } from "@bop/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markBillPaidAction, unmarkBillPaidAction } from "@/app/(platform)/purchase/actions";

/**
 * One confirm-before-you-flip-it interaction for a bill's payment status,
 * reused in the bills table row and the Bill Details Dialog. Marking or
 * unmarking paid is a real financial-state change — it used to fire
 * instantly on a single click with no way back; now both directions ask
 * first, matching the risk ceremony deleting a bill already had.
 */
export function PaymentAction({
  billId,
  isPaid,
  triggerSize = "sm",
  triggerVariant = "ghost",
}: {
  billId: string;
  isPaid: boolean;
  triggerSize?: "sm" | "xs";
  triggerVariant?: "ghost" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run() {
    startTransition(async () => {
      const result = await (isPaid ? unmarkBillPaidAction : markBillPaidAction)(billId);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant}>
          {isPaid ? "Unmark" : "Mark paid"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <p className="text-xs text-muted-foreground">
          {isPaid ? "Mark this purchase bill as unpaid again?" : "Mark this purchase bill as paid?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={run} disabled={pending}>
            {isPaid ? "Unmark paid" : "Confirm"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
