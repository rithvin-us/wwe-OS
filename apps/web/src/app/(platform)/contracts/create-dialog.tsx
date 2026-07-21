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
import { Textarea } from "@bop/ui/components/textarea";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createContractAction } from "@/app/(platform)/contracts/actions";
import { CONTRACT_CATEGORIES, type ContractCategory } from "@/lib/contracts-constants";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function CreateContractDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get("value") ?? "").trim();
    startTransition(async () => {
      const result = await createContractAction({
        title: String(form.get("title") ?? "").trim(),
        counterparty: String(form.get("counterparty") ?? "").trim(),
        category: String(form.get("category") ?? "other") as ContractCategory,
        value: value === "" ? null : value,
        currency:
          String(form.get("currency") ?? "USD")
            .trim()
            .toUpperCase() || "USD",
        start_date: String(form.get("start_date") ?? "") || null,
        end_date: String(form.get("end_date") ?? "") || null,
        auto_renew: form.get("auto_renew") === "on",
        renewal_notice_days: Number(form.get("renewal_notice_days") ?? 30) || 30,
        notes: String(form.get("notes") ?? ""),
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        if (result.id) router.push(`/contracts/${result.id}`);
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
          New contract
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New contract</DialogTitle>
          <DialogDescription>
            Record the agreement now; attach the signed file and send it for approval afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contract-title">Title</Label>
            <Input
              id="contract-title"
              name="title"
              placeholder="e.g. Cloud hosting agreement"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract-counterparty">Counterparty</Label>
            <Input
              id="contract-counterparty"
              name="counterparty"
              placeholder="The other party / supplier"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-category">Category</Label>
              <select
                id="contract-category"
                name="category"
                defaultValue="service"
                className={SELECT_CLASS}
              >
                {CONTRACT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-value">Value</Label>
              <div className="flex gap-2">
                <Input
                  id="contract-currency"
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                  className="w-16 uppercase"
                  aria-label="Currency"
                />
                <Input
                  id="contract-value"
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-start">Start date</Label>
              <Input id="contract-start" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract-end">End date</Label>
              <Input id="contract-end" name="end_date" type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-notice">Renewal notice (days)</Label>
              <Input
                id="contract-notice"
                name="renewal_notice_days"
                type="number"
                min="0"
                max="365"
                defaultValue={30}
              />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="auto_renew" className="size-4 rounded border-input" />
              Auto-renews
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract-notes">Notes</Label>
            <Textarea id="contract-notes" name="notes" rows={2} placeholder="Optional." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
