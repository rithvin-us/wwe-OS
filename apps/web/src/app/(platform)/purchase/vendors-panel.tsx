"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil, Plus } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { DataTable } from "@bop/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createVendorAction, updateVendorAction } from "@/app/(platform)/purchase/actions";
import type { Vendor } from "@/lib/purchase";

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required").max(200),
  gst_number: z.string().trim().max(15, "GSTIN is at most 15 characters").optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

function VendorFormDialog({
  vendor,
  open,
  onOpenChange,
}: {
  vendor?: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: vendor?.name ?? "", gst_number: vendor?.gst_number ?? "" },
  });

  function onSubmit(values: VendorFormValues) {
    startTransition(async () => {
      const result = vendor
        ? await updateVendorAction(vendor.id, {
            name: values.name,
            gst_number: values.gst_number ?? "",
          })
        : await createVendorAction(values.name, values.gst_number ?? "");
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        reset();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
            <DialogDescription>
              {vendor
                ? "Update this vendor's details."
                : "Vendors are also created automatically when you confirm a bill and link a seller name."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name">Vendor name</Label>
              <Input id="vendor-name" autoFocus {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-gst">GST number</Label>
              <Input id="vendor-gst" placeholder="Optional" {...register("gst_number")} />
              {errors.gst_number && (
                <p className="text-xs text-destructive">{errors.gst_number.message}</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending}>
              {vendor ? "Save changes" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorActions({ vendor }: { vendor: Vendor }) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await updateVendorAction(vendor.id, { is_active: !vendor.is_active });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
        <Pencil aria-hidden />
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleActive} disabled={pending}>
        {vendor.is_active ? "Deactivate" : "Activate"}
      </Button>
      <VendorFormDialog vendor={vendor} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

const columns: ColumnDef<Vendor, unknown>[] = [
  {
    accessorKey: "name",
    header: "Vendor",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: "gst_number",
    header: "GST number",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.gst_number || "—"}
      </span>
    ),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "success" : "secondary"}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <VendorActions vendor={row.original} />,
  },
];

export function VendorsPanel({ vendors }: { vendors: Vendor[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Vendors</h2>
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          Add vendor
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={vendors}
        getRowId={(vendor) => vendor.id}
        empty={{
          icon: Building2,
          title: "No vendors yet",
          description: "Vendors appear here once you add one or confirm a bill with a seller name.",
        }}
      />
      <VendorFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}
