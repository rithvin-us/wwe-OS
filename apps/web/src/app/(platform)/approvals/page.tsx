import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { WorkspaceHeaderTabs } from "@/components/workspace-header-tabs";
import { getApprovals } from "@/lib/approvals";

import { ApprovalsInbox } from "./approvals-inbox";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const approvals = await getApprovals();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace · Approvals"
        description="Everything waiting on your decision — leave and expenses — in one inbox, longest-waiting first."
      />
      <WorkspaceHeaderTabs />
      <ApprovalsInbox approvals={approvals} />
    </div>
  );
}
