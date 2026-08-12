"use client";

import { Check, ExternalLink, Inbox, X } from "@bop/icons";
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
import { Label } from "@bop/ui/components/label";
import { Textarea } from "@bop/ui/components/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ApprovalRow } from "@/lib/approvals";

import { decideApprovalAction } from "./actions";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function ApprovalsInbox({ approvals }: { approvals: ApprovalRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<ApprovalRow | null>(null);
  const [note, setNote] = useState("");

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function approve(row: ApprovalRow) {
    run(() => decideApprovalAction(row.kind, row.object_id, "approve"));
  }

  function confirmReject() {
    if (!rejecting) return;
    if (!note.trim()) {
      toast.error("Say why it's being rejected — it goes on the record.");
      return;
    }
    const row = rejecting;
    const reason = note.trim();
    run(() => decideApprovalAction(row.kind, row.object_id, "reject", reason));
    setRejecting(null);
    setNote("");
  }

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing waiting"
        description="Leave requests and expense claims that need a decision show up here."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {approvals.map((row) => (
            <div
              key={`${row.kind}-${row.object_id}`}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{row.label}</Badge>
                  <p className="truncate text-sm font-medium">{row.title}</p>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.requester} · {row.current_step} · {timeAgo(row.submitted_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild size="icon-sm" variant="ghost" title="Open source record">
                  <Link href={row.url}>
                    <ExternalLink aria-hidden />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setRejecting(row)}
                >
                  <X aria-hidden />
                  Reject
                </Button>
                <Button size="sm" disabled={pending} onClick={() => approve(row)}>
                  <Check aria-hidden />
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              The reason is recorded and shown to the requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <Textarea
              id="reject-note"
              rows={3}
              placeholder="e.g. Insufficient leave balance"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
