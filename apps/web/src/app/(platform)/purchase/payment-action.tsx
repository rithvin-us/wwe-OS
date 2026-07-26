"use client";

import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@bop/ui/components/popover";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markBillPaidAction, unmarkBillPaidAction } from "@/app/(platform)/purchase/actions";

export function PaymentAction({ billId, isPaid }: { billId: string; isPaid: boolean }) {
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
        <button
          type="button"
          className="cursor-pointer transition-transform active:scale-95 focus:outline-none"
        >
          {isPaid ? (
            <Badge variant="success" className="cursor-pointer hover:opacity-85">
              Paid
            </Badge>
          ) : (
            <Badge variant="secondary" className="cursor-pointer hover:opacity-85">
              Unpaid
            </Badge>
          )}
        </button>
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
            {isPaid ? "Unmark paid" : "Confirm Paid"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
