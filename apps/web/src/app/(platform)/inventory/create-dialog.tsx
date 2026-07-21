"use client";

import { Plus } from "@bop/icons";
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

import { createItemAction } from "@/app/(platform)/inventory/actions";

export function CreateItemDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cost = String(form.get("unit_cost") ?? "").trim();
    startTransition(async () => {
      const result = await createItemAction({
        name: String(form.get("name") ?? "").trim(),
        sku: String(form.get("sku") ?? "").trim(),
        category: String(form.get("category") ?? ""),
        unit: String(form.get("unit") ?? "unit").trim() || "unit",
        unit_cost: cost === "" ? null : cost,
        currency:
          String(form.get("currency") ?? "USD")
            .trim()
            .toUpperCase() || "USD",
        location: String(form.get("location") ?? ""),
        supplier: String(form.get("supplier") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        if (result.id) router.push(`/inventory/${result.id}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          New item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New inventory item</DialogTitle>
          <DialogDescription>
            Add the item now; record its opening stock with a goods receipt afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" name="name" placeholder="e.g. Copier paper" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-sku">SKU</Label>
              <Input id="item-sku" name="sku" placeholder="e.g. PAP-A4" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-unit">Unit</Label>
              <Input id="item-unit" name="unit" defaultValue="unit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-category">Category</Label>
              <Input id="item-category" name="category" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">Unit cost</Label>
              <div className="flex gap-2">
                <Input
                  id="item-currency"
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                  className="w-16 uppercase"
                  aria-label="Currency"
                />
                <Input
                  id="item-cost"
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-location">Location</Label>
              <Input id="item-location" name="location" placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-supplier">Supplier</Label>
            <Input id="item-supplier" name="supplier" placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Add item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
