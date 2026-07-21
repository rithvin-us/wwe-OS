"use client";

import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Trash2 } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteItemAction, recordMovementAction } from "@/app/(platform)/inventory/actions";
import type { MovementType } from "@/lib/inventory-constants";

const MOVES: {
  type: MovementType;
  label: string;
  icon: typeof ArrowDownToLine;
  title: string;
  hint: string;
  signed: boolean;
}[] = [
  {
    type: "receipt",
    label: "Receive",
    icon: ArrowDownToLine,
    title: "Goods receipt",
    hint: "Add stock that has come in.",
    signed: false,
  },
  {
    type: "issue",
    label: "Issue",
    icon: ArrowUpFromLine,
    title: "Issue stock",
    hint: "Record stock going out or used.",
    signed: false,
  },
  {
    type: "adjustment",
    label: "Adjust",
    icon: SlidersHorizontal,
    title: "Stock adjustment",
    hint: "Correct the count — use a negative number to reduce.",
    signed: true,
  },
];

function MoveDialog({
  id,
  unit,
  move,
}: {
  id: string;
  unit: string;
  move: (typeof MOVES)[number];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const Icon = move.icon;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await recordMovementAction(
        id,
        move.type,
        String(form.get("quantity") ?? ""),
        String(form.get("reason") ?? ""),
        String(form.get("reference") ?? ""),
      );
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={move.type === "receipt" ? "secondary" : "ghost"}>
          <Icon aria-hidden />
          {move.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{move.title}</DialogTitle>
          <DialogDescription>{move.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`qty-${move.type}`}>Quantity ({unit})</Label>
            <Input
              id={`qty-${move.type}`}
              name="quantity"
              type="number"
              step="0.01"
              placeholder={move.signed ? "e.g. -3 to reduce" : "e.g. 20"}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${move.type}`}>Reason</Label>
            <Input id={`reason-${move.type}`} name="reason" placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ref-${move.type}`}>Reference</Label>
            <Input id={`ref-${move.type}`} name="reference" placeholder="Optional — PO or note" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {move.label} stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StockActions({
  id,
  unit,
  hasHistory,
}: {
  id: string;
  unit: string;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteItemAction(id);
      if (result.ok) {
        toast.success(result.message);
        setDeleteOpen(false);
        router.push("/inventory");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MOVES.map((move) => (
        <MoveDialog key={move.type} id={id} unit={unit} move={move} />
      ))}

      {/* Items with stock history can't be deleted (server enforces this too);
          hide the control to set the right expectation. */}
      {hasHistory ? null : (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 aria-hidden />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this item?</DialogTitle>
              <DialogDescription>This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" disabled={pending} onClick={remove}>
                Delete item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
