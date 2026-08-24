"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ExternalLink,
  Inbox,
  X,
} from "@bop/icons";
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

import { actionPhrase, type WorklistItem, type WorkspaceCockpit } from "@/config/workspace";
import { timelineHref } from "@/lib/audit-helpers";

import { decideApprovalAction } from "../approvals/actions";

const URGENCY_BADGE = {
  overdue: "destructive",
  waiting: "default",
  today: "warning",
  soon: "secondary",
} as const;

const URGENCY_ICON = {
  overdue: AlertTriangle,
  waiting: Inbox,
  today: CalendarClock,
  soon: CalendarClock,
} as const;

function CountTile({
  href,
  label,
  value,
  emphasize,
}: {
  href: string;
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
    >
      <span
        className={`text-2xl font-semibold tabular-nums ${
          emphasize && value > 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

function WorklistRow({
  item,
  pending,
  onApprove,
  onReject,
}: {
  item: WorklistItem;
  pending: boolean;
  onApprove: (item: WorklistItem) => void;
  onReject: (item: WorklistItem) => void;
}) {
  const Icon = URGENCY_ICON[item.urgency];
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          aria-hidden
          className={`size-4 shrink-0 ${
            item.urgency === "overdue" ? "text-destructive" : "text-muted-foreground"
          }`}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{item.label}</Badge>
            <p className="truncate text-sm font-medium">{item.title}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.subtitle ? `${item.subtitle} · ` : ""}
            {item.timing}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant={URGENCY_BADGE[item.urgency]} className="hidden sm:inline-flex">
          {item.timing}
        </Badge>
        {item.actionable ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onReject(item)}
              title="Reject"
            >
              <X aria-hidden />
              <span className="sr-only sm:not-sr-only">Reject</span>
            </Button>
            <Button size="sm" disabled={pending} onClick={() => onApprove(item)} title="Approve">
              <Check aria-hidden />
              <span className="sr-only sm:not-sr-only">Approve</span>
            </Button>
          </>
        ) : (
          <Button asChild size="icon-sm" variant="ghost" title="Open record">
            <Link href={item.url}>
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function FocusCockpit({ cockpit }: { cockpit: WorkspaceCockpit }) {
  const { counts, worklist, digest } = cockpit;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<WorklistItem | null>(null);
  const [note, setNote] = useState("");
  const [showDigest, setShowDigest] = useState(false);

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

  function approve(item: WorklistItem) {
    run(() => decideApprovalAction(item.kind, item.object_id, "approve"));
  }

  function confirmReject() {
    if (!rejecting) return;
    if (!note.trim()) {
      toast.error("Say why it's being rejected — it goes on the record.");
      return;
    }
    const item = rejecting;
    const reason = note.trim();
    run(() => decideApprovalAction(item.kind, item.object_id, "reject", reason));
    setRejecting(null);
    setNote("");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <CountTile href="/approvals" label="Waiting on you" value={counts.waiting} />
        <CountTile href="/deadlines" label="Overdue" value={counts.overdue} emphasize />
        <CountTile href="/deadlines" label="Due soon" value={counts.due_soon} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Needs your attention</h2>
        {worklist.length === 0 ? (
          <EmptyState
            icon={Check}
            title="You're all caught up"
            description="Approvals waiting on you and anything due or overdue will appear here, most urgent first."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {worklist.map((item) => (
                <WorklistRow
                  key={`${item.source}-${item.kind}-${item.object_id}`}
                  item={item}
                  pending={pending}
                  onApprove={approve}
                  onReject={setRejecting}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setShowDigest((open) => !open)}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform ${showDigest ? "rotate-180" : ""}`}
          />
          What changed · last {cockpit.window_days} days
        </button>
        {showDigest ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Activity</p>
              {digest.activity.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  Nothing recorded in this window.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {digest.activity.map((row) => (
                    <div
                      key={`${row.module}-${row.action}`}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <span className="capitalize text-foreground">{actionPhrase(row.action)}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent highlights</p>
              {digest.highlights.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="space-y-2">
                  {digest.highlights.map((entry, index) => {
                    const href = timelineHref(entry);
                    const label = actionPhrase(entry.action);
                    const number =
                      typeof entry.changes?.number === "string" ? entry.changes.number : "";
                    return (
                      <li key={`${entry.object_id}-${index}`} className="text-sm">
                        {href ? (
                          <Link href={href} className="font-medium capitalize hover:text-primary">
                            {label}
                          </Link>
                        ) : (
                          <span className="font-medium capitalize">{label}</span>
                        )}
                        <span className="text-muted-foreground">
                          {number ? ` · ${number}` : ` · ${entry.module}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              The reason is recorded and shown to the requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="focus-reject-note">Reason</Label>
            <Textarea
              id="focus-reject-note"
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
    </div>
  );
}
