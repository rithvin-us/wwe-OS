"use client";

import { Ban, Paperclip, Send, Sparkles, Trash2 } from "@bop/icons";
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

import {
  attachContractFileAction,
  deleteContractAction,
  summarizeContractAction,
  terminateContractAction,
} from "@/app/(platform)/contracts/actions";
import type { ContractStatus } from "@/lib/contracts-constants";

type ActionFn = () => Promise<{ ok: boolean; message: string }>;

export function ContractActions({
  id,
  status,
  hasFile,
}: {
  id: string;
  status: ContractStatus;
  hasFile: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachOpen, setAttachOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");

  const isFinal = status === "terminated" || status === "expired";

  function run(action: ActionFn) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await attachContractFileAction(id, formData);
      if (result.ok) {
        toast.success(result.message);
        setAttachOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function terminate() {
    startTransition(async () => {
      const result = await terminateContractAction(id, reason);
      if (result.ok) {
        toast.success(result.message);
        setTerminateOpen(false);
        setReason("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteContractAction(id);
      if (result.ok) {
        toast.success(result.message);
        setDeleteOpen(false);
        router.push("/contracts");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {" "}
      {!isFinal ? (
        <>
          <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={pending}>
                <Paperclip aria-hidden />
                {hasFile ? "Replace file" : "Attach file"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Attach signed file</DialogTitle>
                <DialogDescription>
                  Stored securely and used to summarize the contract.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={attach} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contract-file">File</Label>
                  <Input id="contract-file" name="file" type="file" required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    Attach file
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => summarizeContractAction(id))}
          >
            <Sparkles aria-hidden />
            Regenerate summary
          </Button>
        </>
      ) : null}
      {status === "active" ? (
        <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={pending}>
              <Ban aria-hidden />
              Terminate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Terminate this contract?</DialogTitle>
              <DialogDescription>
                Give a reason — it&apos;s kept with the contract for the record.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Superseded by a new agreement"
              rows={3}
            />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending || reason.trim().length === 0}
                onClick={terminate}
              >
                Terminate contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 aria-hidden />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this contract?</DialogTitle>
            <DialogDescription>
              The contract and any attached file are removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              Delete contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
