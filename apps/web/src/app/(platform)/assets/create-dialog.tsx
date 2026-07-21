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

import { createAssetAction } from "@/app/(platform)/assets/actions";
import { ASSET_CATEGORIES, type AssetCategory } from "@/lib/assets-constants";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function CreateAssetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cost = String(form.get("purchase_cost") ?? "").trim();
    startTransition(async () => {
      const result = await createAssetAction({
        name: String(form.get("name") ?? "").trim(),
        asset_tag: String(form.get("asset_tag") ?? "").trim(),
        category: String(form.get("category") ?? "other") as AssetCategory,
        serial_number: String(form.get("serial_number") ?? ""),
        purchase_date: String(form.get("purchase_date") ?? "") || null,
        purchase_cost: cost === "" ? null : cost,
        currency:
          String(form.get("currency") ?? "USD")
            .trim()
            .toUpperCase() || "USD",
        supplier: String(form.get("supplier") ?? ""),
        location: String(form.get("location") ?? ""),
        notes: String(form.get("notes") ?? ""),
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        if (result.id) router.push(`/assets/${result.id}`);
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
          New asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New asset</DialogTitle>
          <DialogDescription>
            Record the equipment now; assign it, service it, or dispose of it afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">Name</Label>
              <Input id="asset-name" name="name" placeholder="e.g. MacBook Pro 16" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-tag">Tag</Label>
              <Input id="asset-tag" name="asset_tag" placeholder="e.g. IT-0001" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-category">Category</Label>
              <select
                id="asset-category"
                name="category"
                defaultValue="it_equipment"
                className={SELECT_CLASS}
              >
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-serial">Serial number</Label>
              <Input id="asset-serial" name="serial_number" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-date">Purchase date</Label>
              <Input id="asset-date" name="purchase_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-cost">Purchase cost</Label>
              <div className="flex gap-2">
                <Input
                  id="asset-currency"
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                  className="w-16 uppercase"
                  aria-label="Currency"
                />
                <Input
                  id="asset-cost"
                  name="purchase_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asset-supplier">Supplier</Label>
              <Input id="asset-supplier" name="supplier" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-location">Location</Label>
              <Input id="asset-location" name="location" placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Add asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
