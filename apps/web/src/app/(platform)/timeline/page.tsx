import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@bop/icons";
import { Button } from "@bop/ui/components/button";
import { EmptyState } from "@bop/ui/components/empty-state";
import { Input } from "@bop/ui/components/input";
import { Label } from "@bop/ui/components/label";
import { PageHeader } from "@bop/ui/components/page-header";

import { indexLabel } from "@/config/search";
import {
  TIMELINE_MODULES,
  describeEntry,
  getTimeline,
  timelineHref,
  type TimelineModule,
} from "@/lib/audit";

import { BarChartComponent, ChartCard } from "@/components/charts";
import { mockData } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Business Timeline",
};

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function isTimelineModule(value: string): value is TimelineModule {
  return (TIMELINE_MODULES as readonly string[]).includes(value);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string): string {
  return action.replace(/[._]/g, " ");
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    module?: string;
    date_from?: string;
    date_to?: string;
    vendor?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedModule =
    params.module && isTimelineModule(params.module) ? params.module : undefined;
  const page = Math.max(Number(params.page) || 1, 1);

  const data = await getTimeline({
    module: selectedModule,
    dateFrom: params.date_from || undefined,
    dateTo: params.date_to || undefined,
    vendor: params.vendor || undefined,
    page,
  });

  function pageHref(nextPage: number): string {
    const next = new URLSearchParams();
    if (selectedModule) next.set("module", selectedModule);
    if (params.date_from) next.set("date_from", params.date_from);
    if (params.date_to) next.set("date_to", params.date_to);
    if (params.vendor) next.set("vendor", params.vendor);
    next.set("page", String(nextPage));
    return `/timeline?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Timeline"
        description="Everything that happened across the company, most recent first."
      />

      {/* Activity Volume Chart */}
      <ChartCard
        title="Activity Volume by Module"
        description="Recorded platform events across operations"
        badge="Platform Events"
        iconName="history"
      >
        <BarChartComponent
          data={mockData.other.MOCK_TIMELINE_ACTIVITY}
          xAxisKey="module"
          height={160}
          valueSuffix="events"
          series={[{ key: "events", name: "Event Count", color: "var(--module-dashboard)" }]}
        />
      </ChartCard>

      <form
        action="/timeline"
        className="flex flex-wrap items-end gap-4 rounded-lg border border-dashed border-border px-5 py-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="timeline-module" className="text-xs text-muted-foreground">
            Module
          </Label>
          <select
            id="timeline-module"
            name="module"
            defaultValue={selectedModule ?? ""}
            className={SELECT_CLASS}
          >
            <option value="">All</option>
            {TIMELINE_MODULES.map((m) => (
              <option key={m} value={m}>
                {indexLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeline-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="timeline-from"
            type="date"
            name="date_from"
            defaultValue={params.date_from ?? ""}
            className="h-9 w-36"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeline-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="timeline-to"
            type="date"
            name="date_to"
            defaultValue={params.date_to ?? ""}
            className="h-9 w-36"
          />
        </div>
        {!selectedModule || selectedModule === "purchase" ? (
          <div className="space-y-1.5">
            <Label htmlFor="timeline-vendor" className="text-xs text-muted-foreground">
              Vendor (purchases only)
            </Label>
            <Input
              id="timeline-vendor"
              name="vendor"
              defaultValue={params.vendor ?? ""}
              placeholder="Any"
              className="h-9 w-48"
            />
          </div>
        ) : null}
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      {data.entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity"
          description="Nothing matches these filters yet."
        />
      ) : (
        <>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.entries.map((entry) => {
              const href = timelineHref(entry);
              const body = (
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      {indexLabel(entry.module)}
                      {entry.vendorName ? ` · ${entry.vendorName}` : ""}
                    </p>
                    <p className="font-medium text-foreground">{describeEntry(entry)}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {actionLabel(entry.action)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
              );
              return href ? (
                <Link
                  key={entry.id}
                  href={href}
                  className="block transition-colors hover:bg-accent"
                >
                  {body}
                </Link>
              ) : (
                <div key={entry.id}>{body}</div>
              );
            })}
          </div>

          {data.vendorFiltered ? (
            <p className="text-xs text-muted-foreground">
              Showing {data.count} match{data.count === 1 ? "" : "es"} on this page for that vendor
              — the vendor filter narrows results page by page, not across the whole history.
            </p>
          ) : data.pages > 1 ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.pages} · {data.count} total
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                asChild={page < data.pages}
              >
                {page < data.pages ? (
                  <Link href={pageHref(page + 1)}>Next</Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
