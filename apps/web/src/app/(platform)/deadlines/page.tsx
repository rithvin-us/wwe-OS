import type { Metadata } from "next";
import { CalendarClock, ChevronRight } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { EmptyState } from "@bop/ui/components/empty-state";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";

import { WorkspaceHeaderTabs } from "@/components/workspace-header-tabs";
import { formatInvoiceDate } from "@/config/invoices";
import { type DeadlineRow, deadlineKindLabel, deadlineTiming, getDeadlines } from "@/lib/deadlines";

export const metadata: Metadata = { title: "Deadlines" };

function Row({ row }: { row: DeadlineRow }) {
  return (
    <Link
      href={row.url}
      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
    >
      <div className="flex min-w-0 items-center gap-3">
        <CalendarClock
          aria-hidden
          className={`size-4 shrink-0 ${row.is_overdue ? "text-destructive" : "text-muted-foreground"}`}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {deadlineKindLabel(row.kind)} · due {formatInvoiceDate(row.due_date)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={row.is_overdue ? "destructive" : "secondary"}>{deadlineTiming(row)}</Badge>
        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default async function DeadlinesPage() {
  const deadlines = await getDeadlines(60);
  const overdue = deadlines.filter((d) => d.is_overdue);
  const upcoming = deadlines.filter((d) => !d.is_overdue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace · Deadlines"
        description="Everything with a date coming up — invoice due dates, contract renewals — in one place, soonest first."
      />
      <WorkspaceHeaderTabs />

      {deadlines.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing due"
          description="Invoice due dates and contract renewals within the next 60 days show up here."
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-destructive">Overdue ({overdue.length})</h2>
              <div className="overflow-hidden rounded-lg border border-destructive/40 bg-card">
                <div className="divide-y divide-border">
                  {overdue.map((row) => (
                    <Row key={`${row.kind}-${row.object_id}`} row={row} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Upcoming ({upcoming.length})</h2>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="divide-y divide-border">
                  {upcoming.map((row) => (
                    <Row key={`${row.kind}-${row.object_id}`} row={row} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
