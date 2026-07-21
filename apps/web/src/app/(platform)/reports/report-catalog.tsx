"use client";

import { Download, FileSearch } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { runReportAction } from "@/app/(platform)/reports/actions";
import type { ReportCatalogEntry } from "@/lib/reports";

const FORMATS = ["csv", "xlsx", "pdf", "html"] as const;

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function ReportRow({ report }: { report: ReportCatalogEntry }) {
  const [format, setFormat] = useState<string>("csv");
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runReportAction(report.key, format);
      if (result.ok && result.downloadUrl) {
        toast.success(result.message);
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{report.label}</p>
        <p className="text-sm text-muted-foreground">{report.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          className={SELECT_CLASS}
          aria-label={`Format for ${report.label}`}
        >
          {FORMATS.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={run} disabled={pending}>
          <Download aria-hidden />
          Run
        </Button>
      </div>
    </div>
  );
}

export function ReportCatalog({ reports }: { reports: ReportCatalogEntry[] }) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No reports available"
        description="Reports appear here as the areas that produce them come online."
      />
    );
  }
  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <ReportRow key={report.key} report={report} />
      ))}
    </div>
  );
}
