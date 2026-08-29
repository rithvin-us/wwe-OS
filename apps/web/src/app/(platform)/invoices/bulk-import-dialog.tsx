"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, X } from "@bop/icons";
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
import { Dropzone } from "@bop/ui/components/dropzone";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { toast } from "sonner";

const MAX_BYTES = 15 * 1024 * 1024;

/** Upload a batch of already-issued invoice scans. On success it routes to the
 * batch's review grid, where OCR fills in as each scan is read. */
export function BulkImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  function addFiles(incoming: File[]) {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  }

  function removeAt(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function upload() {
    if (files.length === 0) return;
    setBusy(true);
    const form = new FormData();
    for (const file of files) form.append("files", file);
    if (label.trim()) form.set("label", label.trim());

    try {
      const response = await fetch("/api/finance/invoice-imports", { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(json?.error?.message ?? `Upload failed (HTTP ${response.status}).`);
        setBusy(false);
        return;
      }
      const batch = json.data ?? json;
      const accepted: number = batch.accepted ?? files.length;
      const duplicates: string[] = batch.duplicates ?? [];
      toast.success(
        `Uploaded ${accepted} invoice${accepted === 1 ? "" : "s"} — reading them now.` +
          (duplicates.length ? ` ${duplicates.length} duplicate skipped.` : ""),
      );
      setOpen(false);
      setFiles([]);
      setLabel("");
      router.push(`/invoices/import/${batch.id}`);
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp aria-hidden className="size-4" />
          Bulk import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import historical invoices</DialogTitle>
          <DialogDescription>
            Upload scans or PDFs of invoices already issued this year. Each is read automatically,
            then you confirm the details and it joins the register under its own number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Dropzone
            onFiles={addFiles}
            accept="image/*,.pdf"
            multiple
            maxSizeBytes={MAX_BYTES}
            label="Drop invoice scans or PDFs, or click to browse"
            hint="Add up to a few dozen at once — the number, customer and amounts are read for you."
          />

          {files.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"} ready
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}:${file.size}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="bulk-import-label">Batch name (optional)</Label>
            <Input
              id="bulk-import-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. FY 2026-27 back-fill"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={upload} disabled={busy || files.length === 0}>
            {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {busy
              ? "Uploading…"
              : `Upload ${files.length || ""} scan${files.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
