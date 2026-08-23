import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { DocumentsTable } from "@/app/(platform)/dms/documents-table";
import { UploadDialog } from "@/app/(platform)/dms/upload-dialog";
import { DMSStatTiles, DMSCharts } from "@/app/(platform)/dms/dms-dashboard";
import { getDocuments } from "@/lib/dms";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function DmsPage() {
  const documents = await getDocuments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Outside incoming files, contracts, policies, and email attachments from waterworksengineering@gmail.com."
        actions={<UploadDialog />}
      />

      <DMSStatTiles documents={documents} />

      <DocumentsTable documents={documents} />

      <DMSCharts documents={documents} />
    </div>
  );
}
