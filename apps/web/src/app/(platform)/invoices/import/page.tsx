import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileStack } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { PageHeader } from "@bop/ui/components/page-header";

import type { ImportBatch, ImportBatchStatus } from "@/config/invoices";
import { formatInvoiceDate } from "@/config/invoices";
import { getInvoiceImports } from "@/lib/invoices";

import { BulkImportDialog } from "../bulk-import-dialog";

export const metadata: Metadata = {
  title: "Import invoices",
};

const BATCH_STATUS: Record<
  ImportBatchStatus,
  { label: string; variant: "secondary" | "warning" | "success" | "outline" }
> = {
  processing: { label: "Reading", variant: "secondary" },
  review: { label: "In review", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  archived: { label: "Archived", variant: "outline" },
};

export default async function ImportInvoicesPage() {
  const batches = await getInvoiceImports();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import historical invoices"
        description="Back-fill invoices already issued this year from their scans. Each is read automatically, reviewed, then joins the register under its own number."
        actions={<BulkImportDialog />}
      />

      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to invoices
      </Link>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <FileStack aria-hidden className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No imports yet</p>
            <p className="text-sm text-muted-foreground">
              Upload a batch of invoice scans to get started — the details are read for you.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {batches.map((batch) => (
            <li key={batch.id}>
              <BatchRow batch={batch} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BatchRow({ batch }: { batch: ImportBatch }) {
  const status = BATCH_STATUS[batch.status];
  const { counts } = batch;
  const pending = counts.queued + counts.processing;
  const needsReview = counts.extracted + counts.needs_attention;

  return (
    <Link
      href={`/invoices/import/${batch.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{batch.label}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatInvoiceDate(batch.created_at)} · {counts.total} invoice
          {counts.total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {pending > 0 ? <span>{pending} reading</span> : null}
        {needsReview > 0 ? <span className="text-warning">{needsReview} to review</span> : null}
        {counts.committed > 0 ? (
          <span className="text-success">{counts.committed} committed</span>
        ) : null}
        {counts.failed > 0 ? (
          <span className="text-destructive">{counts.failed} failed</span>
        ) : null}
      </div>
    </Link>
  );
}
