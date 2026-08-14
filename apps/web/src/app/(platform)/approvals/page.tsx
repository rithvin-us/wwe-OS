import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { getApprovals } from "@/lib/approvals";

import { ApprovalsInbox } from "./approvals-inbox";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const approvals = await getApprovals();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approvals"
        description="Everything waiting on your decision — leave and expenses — in one inbox, longest-waiting first."
      />
      <ApprovalsInbox approvals={approvals} />
    </div>
  );
}
