import type { Metadata } from "next";
import { Bot, FileText, Mail, ShieldCheck } from "@bop/icons";
import { PageHeader } from "@bop/ui/components/page-header";

import { HelpdeskWorkspace } from "@/components/chatbot/helpdesk-workspace";

export const metadata: Metadata = {
  title: "Rithu Assistant",
};

export default function ChatbotPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rithu Assistant"
        description="Your AI assistant for finding files, drafting emails, and checking business performance."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Bot className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>AI Gateway</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">Gemini 2.5 Flash</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Connected via GEMINI_API_KEY</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Indexed Files</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">4 Rithu Documents</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Contracts, Finance, HR, DMS</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Mail className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Email Drafter</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">Active & Ready</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Vendors, Employees, Execs</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Security Mode</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">Tenant Isolated</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Water Works Engineering</p>
        </div>
      </div>

      <HelpdeskWorkspace />
    </div>
  );
}
