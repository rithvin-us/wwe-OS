import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Button } from "@bop/ui/components/button";
import { PageHeader } from "@bop/ui/components/page-header";

import { DESTINATION_LABELS, type AutomationRun } from "@/config/automation";
import { djangoFetch } from "@/lib/api/server";
import { getRun } from "@/lib/automation";

export const metadata: Metadata = {
  title: "Automation run",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function resolveDownloadUrl(run: AutomationRun): Promise<string | null> {
  if (run.download_url) return run.download_url;
  try {
    if (run.filename) {
      const res = await djangoFetch<{ url: string }>(`/api/v1/automation/runs/${run.id}/url/`);
      return res.url;
    }
    if (run.report_export_id) {
      const res = await djangoFetch<{ url: string }>(
        `/api/v1/reporting/exports/${run.report_export_id}/url/`,
      );
      return res.url;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/automation">
            <ArrowLeft aria-hidden />
            Automation
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">This run couldn&apos;t be found.</p>
      </div>
    );
  }

  const downloadUrl = await resolveDownloadUrl(run);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/automation">
          <ArrowLeft aria-hidden />
          Automation
        </Link>
      </Button>

      <PageHeader
        title={run.rule_name}
        description={`${DESTINATION_LABELS[run.destination]} · ${
          run.triggered_by === "manual" ? "Manual" : "Scheduled"
        } run`}
        meta={
          <Badge variant={run.status === "success" ? "success" : "destructive"}>
            {run.status === "success" ? "Success" : "Failed"}
          </Badge>
        }
        actions={
          downloadUrl ? (
            <Button asChild>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download aria-hidden />
                Download
              </a>
            </Button>
          ) : undefined
        }
      />

      {run.status === "failed" && run.error_message ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {run.error_message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Started
          </p>
          <p className="mt-1 text-sm font-medium">{formatDateTime(run.started_at)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Finished
          </p>
          <p className="mt-1 text-sm font-medium">{formatDateTime(run.finished_at)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Items
          </p>
          <p className="mt-1 text-sm font-medium">{run.item_count}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            File
          </p>
          <p className="mt-1 truncate text-sm font-medium">{run.filename ?? "—"}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          What this run collected
        </h2>
        {run.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            No items were matched.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {run.items.map((item, index) => (
              <div
                key={`${item.object_id}-${index}`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.module ? `${item.module} · ` : ""}
                    {item.object_type}
                  </p>
                </div>
                <Badge variant={item.included ? "secondary" : "outline"}>
                  {item.included ? "Included" : "No file found"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
