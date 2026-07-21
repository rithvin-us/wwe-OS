"use client";

import { Archive, Send, Sparkles, Trash2 } from "@bop/icons";
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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveDocumentAction,
  deleteDocumentAction,
  summarizeDocumentAction,
} from "@/app/(platform)/dms/actions";
import type { DocumentStatus } from "@/lib/dms-constants";

export function DocumentActions({ id, status }: { id: string; status: DocumentStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteDocumentAction(id);
      if (result.ok) {
        toast.success(result.message);
        setConfirmOpen(false);
        router.push("/dms");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "archived" ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => summarizeDocumentAction(id))}
          >
            <Sparkles aria-hidden />
            Regenerate summary
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => archiveDocumentAction(id))}
          >
            <Archive aria-hidden />
            Archive
          </Button>
        </>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 aria-hidden />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              The file and its record are removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              Delete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
