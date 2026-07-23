"use client";

import { Download, FileSearch } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { TagPicker, type TagPickerChange } from "@bop/ui/components/tag-picker";
import type { TagLike } from "@bop/ui/components/tag-pill";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { type ReportFilters, runReportAction } from "@/app/(platform)/reports/actions";
import type { ReportCatalogEntry } from "@/lib/reports";

const FORMATS = ["csv", "xlsx", "pdf", "html"] as const;

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function ReportRow({ report, filters }: { report: ReportCatalogEntry; filters: ReportFilters }) {
  const [format, setFormat] = useState<string>("csv");
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runReportAction(report.key, format, filters);
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

function FilterBar({
  dateFrom,
  dateTo,
  vendor,
  tags,
  allTags,
  onDateFromChange,
  onDateToChange,
  onVendorChange,
  onTagsChange,
}: {
  dateFrom: string;
  dateTo: string;
  vendor: string;
  tags: TagLike[];
  allTags: TagLike[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onVendorChange: (value: string) => void;
  onTagsChange: (change: TagPickerChange) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-dashed border-border px-5 py-4">
      <div className="space-y-1.5">
        <Label htmlFor="report-date-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="report-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="h-8 w-36"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-date-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="report-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="h-8 w-36"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-vendor" className="text-xs text-muted-foreground">
          Vendor / counterparty
        </Label>
        <Input
          id="report-vendor"
          placeholder="Any"
          value={vendor}
          onChange={(event) => onVendorChange(event.target.value)}
          className="h-8 w-48"
        />
      </div>
      <div className="space-y-1.5">
        <span className="block text-xs text-muted-foreground">Tags</span>
        <TagPicker tags={tags} allTags={allTags} onChange={onTagsChange} />
      </div>
    </div>
  );
}

export function ReportCatalog({
  reports,
  allTags,
}: {
  reports: ReportCatalogEntry[];
  allTags: TagLike[];
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendor, setVendor] = useState("");
  const [tags, setTags] = useState<TagLike[]>([]);

  const filters: ReportFilters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      vendor: vendor.trim() || undefined,
      tagIds: tags.map((tag) => tag.id),
    }),
    [dateFrom, dateTo, vendor, tags],
  );

  function handleTagsChange(change: TagPickerChange) {
    setTags(allTags.filter((tag) => change.tagIds.includes(tag.id)));
  }

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
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        vendor={vendor}
        tags={tags}
        allTags={allTags}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onVendorChange={setVendor}
        onTagsChange={handleTagsChange}
      />
      {reports.map((report) => (
        <ReportRow key={report.key} report={report} filters={filters} />
      ))}
    </div>
  );
}
