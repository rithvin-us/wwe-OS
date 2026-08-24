import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { WorkspaceHeaderTabs } from "@/components/workspace-header-tabs";
import { getWorkspace } from "@/lib/briefing";

import { FocusCockpit } from "./focus-cockpit";

export const metadata: Metadata = { title: "Focus" };

export default async function FocusPage() {
  const cockpit = await getWorkspace(7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace · Focus"
        description="Everything that needs you, most urgent first — approvals to decide and dates coming due, actionable in one place."
      />
      <WorkspaceHeaderTabs />
      <FocusCockpit cockpit={cockpit} />
    </div>
  );
}
