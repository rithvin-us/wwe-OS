"use client";

import { Ban, CircleCheck, Paperclip, UserCheck, UserMinus, Wrench, Trash2 } from "@bop/icons";
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
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignAssetAction,
  attachAssetFileAction,
  completeMaintenanceAction,
  deleteAssetAction,
  disposeAssetAction,
  returnAssetAction,
  startMaintenanceAction,
} from "@/app/(platform)/assets/actions";
import type { AssetStatus } from "@/lib/assets-constants";

type Result = { ok: boolean; message: string };

/** A small dialog wrapper that runs a submit handler in a transition. */
function ActionDialog({
  trigger,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  submitVariant = "default",
  canSubmit = true,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  onSubmit: (form: FormData) => Promise<Result>;
  submitLabel: string;
  submitVariant?: "default" | "destructive";
  canSubmit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await onSubmit(form);
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="submit" variant={submitVariant} disabled={pending || !canSubmit}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssetActions({
  id,
  status,
  hasFile,
  hasHistory,
}: {
  id: string;
  status: AssetStatus;
  hasFile: boolean;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const disposed = status === "disposed";

  function run(action: () => Promise<Result>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteAssetAction(id);
      if (result.ok) {
        toast.success(result.message);
        setDeleteOpen(false);
        router.push("/assets");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "in_stock" ? (
        <ActionDialog
          trigger={
            <Button size="sm" variant="secondary">
              <UserCheck aria-hidden />
              Assign
            </Button>
          }
          title="Assign asset"
          description="Who is taking this asset?"
          submitLabel="Assign"
          onSubmit={(form) => assignAssetAction(id, String(form.get("assigned_to") ?? ""))}
        >
          <div className="space-y-1.5">
            <Label htmlFor="assign-to">Assigned to</Label>
            <Input id="assign-to" name="assigned_to" placeholder="Person or team" required />
          </div>
        </ActionDialog>
      ) : null}

      {status === "assigned" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => returnAssetAction(id))}
        >
          <UserMinus aria-hidden />
          Return
        </Button>
      ) : null}

      {status === "in_stock" || status === "assigned" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => startMaintenanceAction(id))}
        >
          <Wrench aria-hidden />
          Send to maintenance
        </Button>
      ) : null}

      {status === "in_maintenance" ? (
        <ActionDialog
          trigger={
            <Button size="sm" variant="secondary">
              <CircleCheck aria-hidden />
              Complete maintenance
            </Button>
          }
          title="Complete maintenance"
          description="Record what was done; the asset returns to stock."
          submitLabel="Record maintenance"
          onSubmit={(form) =>
            completeMaintenanceAction(id, {
              description: String(form.get("description") ?? ""),
              cost: String(form.get("cost") ?? "").trim() || null,
              vendor: String(form.get("vendor") ?? ""),
            })
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">What was done</Label>
            <Input id="m-desc" name="description" placeholder="e.g. Battery replacement" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-cost">Cost</Label>
              <Input
                id="m-cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-vendor">Vendor</Label>
              <Input id="m-vendor" name="vendor" placeholder="Optional" />
            </div>
          </div>
        </ActionDialog>
      ) : null}

      {!disposed ? (
        <ActionDialog
          trigger={
            <Button size="sm" variant="ghost">
              <Paperclip aria-hidden />
              {hasFile ? "Replace file" : "Attach file"}
            </Button>
          }
          title="Attach a file"
          description="Warranty, invoice, or manual — stored securely."
          submitLabel="Attach file"
          onSubmit={(form) => attachAssetFileAction(id, form)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="asset-file">File</Label>
            <Input id="asset-file" name="file" type="file" required />
          </div>
        </ActionDialog>
      ) : null}

      {!disposed ? (
        <ActionDialog
          trigger={
            <Button size="sm" variant="ghost">
              <Ban aria-hidden />
              Dispose
            </Button>
          }
          title="Dispose of this asset?"
          description="Records the disposal and removes it from the active register."
          submitLabel="Dispose asset"
          submitVariant="destructive"
          onSubmit={(form) =>
            disposeAssetAction(id, {
              reason: String(form.get("reason") ?? ""),
              proceeds: String(form.get("proceeds") ?? "").trim() || null,
            })
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="d-reason">Reason</Label>
            <Input id="d-reason" name="reason" placeholder="e.g. End of life, sold" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-proceeds">Proceeds</Label>
            <Input
              id="d-proceeds"
              name="proceeds"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional"
            />
          </div>
        </ActionDialog>
      ) : null}

      {!hasHistory ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              <Trash2 aria-hidden />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this asset?</DialogTitle>
              <DialogDescription>This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" disabled={pending} onClick={remove}>
                Delete asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
