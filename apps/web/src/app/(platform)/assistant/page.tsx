import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { AssistantPanel } from "./assistant-panel";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Assistant"
        description="Ask about your company's data. Answers come only from your WWE OS records — invoices, customers, sites, contracts, documents — with links to the sources. It won't invent figures."
      />
      <AssistantPanel />
    </div>
  );
}
