import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { DocumentsTable } from "@/app/(platform)/dms/documents-table";
import { UploadDialog } from "@/app/(platform)/dms/upload-dialog";
import { getDocuments } from "@/lib/dms";

export const metadata: Metadata = {
  title: "Documents",
};

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function DmsPage() {
  const documents = await getDocuments();
  const counts = {
    total: documents.length,
    active: documents.filter((d) => d.status === "active").length,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Store company files, let the assistant summarize them, and route them for approval."
        actions={<UploadDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="All documents" value={counts.total} />
        <StatTile label="Active" value={counts.active} />
      </div>

      <DocumentsTable documents={documents} />
    </div>
  );
}
