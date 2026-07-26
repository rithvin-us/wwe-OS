"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus } from "@bop/icons";
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
import { EmptyState } from "@bop/ui/components/empty-state";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { Textarea } from "@bop/ui/components/textarea";
import { toast } from "sonner";

import type { BillingCustomer } from "@/config/invoices";

import { saveCustomerAction } from "./actions";

const BLANK = {
  name: "",
  address: "",
  facility: "",
  gstin: "",
  state: "",
  is_sez: false,
};

/**
 * The billing master. SEZ is set here and nowhere else — it decides whether
 * every invoice for this site carries IGST or CGST + SGST.
 */
export function CustomersSection({ customers }: { customers: BillingCustomer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<BillingCustomer | null>(null);
  const [form, setForm] = useState(BLANK);

  function startNew() {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  }

  function startEdit(customer: BillingCustomer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      address: customer.address,
      facility: customer.facility,
      gstin: customer.gstin,
      state: customer.state,
      is_sez: customer.is_sez,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("A customer needs a name.");
      return;
    }
    setBusy(true);
    const result = await saveCustomerAction({ ...form, name: form.name.trim() }, editing?.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Customers &amp; sites
        </h2>
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="mr-2 size-4" /> Add customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers yet"
          description="Add the companies and sites you bill. Mark a site as SEZ here and every invoice raised for it switches to IGST automatically."
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {customers.map((customer) => (
            <div key={customer.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                  {customer.is_sez ? <Badge variant="warning">SEZ · IGST</Badge> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[customer.facility, customer.gstin || null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(customer)}>
                <Pencil className="mr-2 size-4" /> Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
            <DialogDescription>
              These details are printed on the invoice as the consignee and facility.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                rows={3}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-facility">Facility / site</Label>
                <Input
                  id="customer-facility"
                  value={form.facility}
                  onChange={(event) => setForm({ ...form, facility: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-gstin">GSTIN</Label>
                <Input
                  id="customer-gstin"
                  value={form.gstin}
                  onChange={(event) => setForm({ ...form, gstin: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-state">State</Label>
              <Input
                id="customer-state"
                className="sm:w-64"
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={form.is_sez}
                onChange={(event) => setForm({ ...form, is_sez: event.target.checked })}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">
                  This is an SEZ site
                </span>
                <span className="block text-xs text-muted-foreground">
                  Invoices for an SEZ site are billed under IGST. Everything else is billed under
                  CGST + SGST.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={handleSave}>
              {busy ? "Saving…" : "Save customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
