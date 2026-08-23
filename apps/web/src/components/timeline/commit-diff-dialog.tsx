"use client";

import Link from "next/link";
import { ExternalLink, GitCommit, Copy, Check } from "@bop/icons";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@bop/ui/components/dialog";
import { Button } from "@bop/ui/components/button";
import { describeEntry, timelineHref, type TimelineEntry } from "@/lib/audit-helpers";

interface CommitDiffDialogProps {
  entry: TimelineEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getCommitHash(id: string): string {
  if (id.length <= 8) return id;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

export function CommitDiffDialog({ entry, open, onOpenChange }: CommitDiffDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const commitHash = getCommitHash(entry.id);
  const href = timelineHref(entry);
  const title = describeEntry(entry);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(commitHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(entry.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader className="space-y-3 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GitCommit className="h-4 w-4" />
              </span>
              <DialogTitle className="font-mono text-base font-semibold tracking-wide">
                commit {commitHash}
              </DialogTitle>
              <button
                onClick={handleCopyHash}
                className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy commit hash"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-blue-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground uppercase tracking-wider">
              {entry.module}
            </span>
          </div>
          <DialogDescription className="text-sm font-medium text-foreground">
            {title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Metadata Bar */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Author / Actor: </span>
              <span className="font-mono font-medium text-foreground">
                {entry.actor || "System / Operator"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-mono text-foreground">{formattedDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Action: </span>
              <span className="font-mono font-medium text-foreground">{entry.action}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Target Record: </span>
              <span className="font-mono text-foreground">
                {entry.object_type} (#{entry.object_id.slice(0, 10)})
              </span>
            </div>
          </div>

          {/* Unified Git Diff View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">Payload Diff Inspection</span>
              <span>JSON Audit State</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-slate-950 p-4 text-xs font-mono text-slate-100 shadow-inner dark:bg-black">
              <div className="text-slate-500">commit {entry.id}</div>
              <div className="text-slate-500">
                Author: {entry.actor || "Operator"} &lt;operator@wwe-os.local&gt;
              </div>
              <div className="text-slate-500">Date: {formattedDate}</div>
              <div className="my-2 border-b border-slate-800" />
              <div className="text-sky-400">
                diff --git a/module/{entry.module}/{entry.object_type} b/module/{entry.module}/
                {entry.object_type}
              </div>
              <div className="text-slate-400">
                index {commitHash}..{commitHash.slice(0, 6)}0 100644
              </div>
              <div className="text-slate-400">--- a/{entry.object_type}</div>
              <div className="text-slate-400">+++ b/{entry.object_type}</div>
              <div className="text-amber-400 font-bold">
                @@ -1,4 +1,{Object.keys(entry.changes || {}).length + 2} @@
              </div>
              <div className="text-slate-300"> module: &quot;{entry.module}&quot;</div>
              <div className="text-slate-300"> action: &quot;{entry.action}&quot;</div>

              {entry.changes && Object.keys(entry.changes).length > 0 ? (
                Object.entries(entry.changes).map(([key, val]) => (
                  <div key={key} className="text-blue-400 bg-blue-950/30 px-1 py-0.5">
                    + {key}: {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">+ (No state mutation payload captured)</div>
              )}
            </div>
          </div>

          {/* Navigation Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {href ? (
              <Button size="sm" asChild>
                <Link href={href} className="inline-flex items-center gap-1.5">
                  <span>Open Target Record</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
