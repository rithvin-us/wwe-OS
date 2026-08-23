import type { Metadata } from "next";
import { Activity, AlertTriangle, CalendarClock, Inbox } from "@bop/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";
import Link from "next/link";

import { WorkspaceHeaderTabs } from "@/components/workspace-header-tabs";
import { timelineHref } from "@/lib/audit-helpers";
import { actionPhrase, getBriefing } from "@/lib/briefing";

export const metadata: Metadata = { title: "Briefing" };

function AttentionTile({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: "default" | "warning";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
    >
      <Icon
        aria-hidden
        className={`size-5 ${tone === "warning" && value > 0 ? "text-destructive" : "text-muted-foreground"}`}
      />
      <div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

export default async function BriefingPage() {
  const briefing = await getBriefing(7);
  const { activity, highlights, attention, window_days } = briefing;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace · Briefing"
        description={`What changed in your company over the last ${window_days} days — real movements, each linking to its records.`}
      />

      <WorkspaceHeaderTabs />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AttentionTile
          href="/approvals"
          icon={Inbox}
          label="Pending approvals"
          value={attention.pending_approvals}
          tone="default"
        />
        <AttentionTile
          href="/deadlines"
          icon={AlertTriangle}
          label="Overdue"
          value={attention.overdue}
          tone="warning"
        />
        <AttentionTile
          href="/deadlines"
          icon={CalendarClock}
          label="Due soon"
          value={attention.due_soon}
          tone="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity aria-hidden className="size-4 text-muted-foreground" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing recorded in this window.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((row) => (
                  <div
                    key={`${row.module}-${row.action}`}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <span className="capitalize text-foreground">{actionPhrase(row.action)}</span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent highlights</CardTitle>
          </CardHeader>
          <CardContent>
            {highlights.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="space-y-3">
                {highlights.map((entry, index) => {
                  const href = timelineHref(entry);
                  const label = actionPhrase(entry.action);
                  const number =
                    typeof entry.changes?.number === "string" ? entry.changes.number : "";
                  return (
                    <li key={`${entry.object_id}-${index}`} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
                      />
                      <div className="min-w-0 text-sm">
                        {href ? (
                          <Link href={href} className="font-medium capitalize hover:text-primary">
                            {label}
                          </Link>
                        ) : (
                          <span className="font-medium capitalize">{label}</span>
                        )}
                        <span className="text-muted-foreground">
                          {number ? ` · ${number}` : ` · ${entry.module}`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
