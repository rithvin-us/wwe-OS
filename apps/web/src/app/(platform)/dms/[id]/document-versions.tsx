"use client";

import { Eye, History, Link2, RotateCcw, Upload } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import type { DocumentVersionRecord } from "@/lib/dms";

import { addVersionAction, restoreVersionAction, shareDocumentAction } from "../actions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentVersions({
  documentId,
  versions,
  canWrite,
}: {
  documentId: string;
  versions: DocumentVersionRecord[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await addVersionAction(documentId, formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function restore(version: number) {
    startTransition(async () => {
      const result = await restoreVersionAction(documentId, version);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  async function share() {
    const result = await shareDocumentAction(documentId);
    if (!result.ok || !result.url) {
      toast.error(result.message);
      return;
    }
    const absolute = `${window.location.origin}${result.url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("Share link copied — expires in 1 hour.");
    } catch {
      toast.message("Share link ready", { description: absolute });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History aria-hidden className="size-4 text-muted-foreground" />
          Version history
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={share}>
            <Link2 aria-hidden />
            Share link
          </Button>
          {canWrite ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={onUpload}
                disabled={pending}
              />
              <Button size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden />
                New version
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {versions.map((version) => (
          <div key={version.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">v{version.version}</span>
                {version.is_current ? <Badge variant="success">Current</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {version.file_name} · {formatBytes(version.file_size)}
                {version.uploaded_by_email ? ` · ${version.uploaded_by_email}` : ""}
                {version.note ? ` · ${version.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {version.is_current ? (
                <Button asChild size="icon-sm" variant="ghost" title="Preview">
                  <a href={`/api/dms/${documentId}/preview`} target="_blank" rel="noreferrer">
                    <Eye aria-hidden />
                  </a>
                </Button>
              ) : canWrite ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => restore(version.version)}
                >
                  <RotateCcw aria-hidden />
                  Restore
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
