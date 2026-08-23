import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { WorkspaceHeaderTabs } from "@/components/workspace-header-tabs";
import { AssistantPanel } from "./assistant-panel";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Workspace · Assistant"
        description="Ask about your company's data. Answers come only from your WWE OS records — invoices, customers, sites, contracts, documents — with links to the sources."
      />
      <WorkspaceHeaderTabs />
      <AssistantPanel />
    </div>
  );
}
