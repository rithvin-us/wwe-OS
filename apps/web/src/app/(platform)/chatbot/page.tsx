import type { Metadata } from "next";
import { Bot, FileText, Mail, ShieldCheck } from "@bop/icons";
import { PageHeader } from "@bop/ui/components/page-header";

import { HelpdeskWorkspace } from "@/components/chatbot/helpdesk-workspace";
import { COMPANY } from "@/config/company";
import { getRuntimeStatus } from "@/lib/maintenance";

export const metadata: Metadata = {
  title: "Assistant Settings",
};

export default async function ChatbotPage() {
  // These cards previously asserted "Gemini 2.5 Flash" and "Connected via
  // GEMINI_API_KEY" as static text. The model name was actually wrong —
  // Google retired gemini-2.5-flash (see commit c9f71cb) — and the
  // "connected" claim was never checked. Read the effective model and
  // reachability off the kernel instead.
  const { data, reachable } = await getRuntimeStatus();
  const model = reachable ? data.config.ai_default_model : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant Settings"
        description="Configure Rithu AI rules, seasonal operating mode, system instructions, and model parameters."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Bot className="size-4 text-blue-600 dark:text-blue-400" />
            <span>AI Gateway</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">{model ?? "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {reachable ? "Reported by the platform kernel" : "Kernel unreachable"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Indexed Files</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">&mdash;</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            No index count is published yet
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Mail className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Email Drafter</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">Active & Ready</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Vendors, Employees, Execs</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Security Mode</span>
          </div>
          <p className="mt-1 font-mono text-lg font-semibold text-foreground">Tenant Isolated</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{COMPANY.name}</p>
        </div>
      </div>

      <HelpdeskWorkspace />
    </div>
  );
}
