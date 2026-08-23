import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { TIMELINE_MODULES, getTimeline, type TimelineModule } from "@/lib/audit";

import { BarChartComponent, ChartCard } from "@/components/charts";
import { mockData } from "@/lib/mock-data";
import { GitTimelineGraph } from "@/components/timeline/git-timeline-graph";

export const metadata: Metadata = {
  title: "Business Timeline | Git Commit Graph",
};

function isTimelineModule(value: string): value is TimelineModule {
  return (TIMELINE_MODULES as readonly string[]).includes(value);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Timeline & Git Commit Graph"
        description="Real-time DAG visualization of company events, audit logs, and module actions."
      />

      {/* Activity Volume Chart */}
      <ChartCard
        title="Activity Volume by Module"
        empty={mockData.other.MOCK_TIMELINE_ACTIVITY.length === 0}
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

      {/* Real-time Interactive Git Commit Graph */}
      <GitTimelineGraph initialEntries={data.entries} initialCount={data.count} />
    </div>
  );
}
