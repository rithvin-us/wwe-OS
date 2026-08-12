import type { Metadata } from "next";
import { AlertTriangle, Database, HardDrive, ShieldCheck } from "@bop/icons";
import { Badge } from "@bop/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bop/ui/components/card";
import { PageHeader } from "@bop/ui/components/page-header";

import {
  BACKUP_KIND_LABELS,
  type BackupArea,
  formatBytes,
  getBackupStatus,
} from "@/lib/backups";

export const metadata: Metadata = { title: "Backups" };

function StatusBadge({ area }: { area: BackupArea }) {
  if (area.status === "not_configured") return <Badge variant="secondary">Not configured</Badge>;
  if (area.status === "stale") return <Badge variant="warning">Stale</Badge>;
  return <Badge variant="success">Healthy</Badge>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function BackupsPage() {
  const summary = await getBackupStatus();
  const anyUnconfigured = summary.areas.some((a) => !a.configured);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Backups & recovery"
        description="What the backup infrastructure has reported. Nothing here means a backup exists until it has been recorded — and a backup is only 'verified' once a restore test has actually restored it."
      />

      {anyUnconfigured ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            One or more areas have no successful backup recorded. Backups are infrastructure and must
            be configured separately; runs appear here once the backup job records them via{" "}
            <code className="font-mono text-xs">manage.py backup_record</code>.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.areas.map((area) => (
          <Card key={area.kind}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Database aria-hidden className="size-4 text-muted-foreground" />
                  {BACKUP_KIND_LABELS[area.kind] ?? area.kind}
                </span>
                <StatusBadge area={area} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last successful</span>
                <span className="font-medium">{formatDate(area.last_success_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Age</span>
                <span className="font-medium">
                  {area.age_days === null ? "—" : `${area.age_days} day(s)`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{formatBytes(area.size_bytes)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Restore-tested</span>
                {area.verified ? (
                  <Badge variant="success">
                    <ShieldCheck aria-hidden />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Not verified</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive aria-hidden className="size-4 text-muted-foreground" />
              Storage in use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBytes(summary.storage.total_bytes)}
            </p>
            <p className="text-xs text-muted-foreground">
              across {summary.storage.file_count} file(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent failures</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent_failures.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No failures recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.recent_failures.map((failure, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div>
                      <p className="font-medium">{BACKUP_KIND_LABELS[failure.kind] ?? failure.kind}</p>
                      <p className="text-xs text-muted-foreground">
                        {failure.message || "No detail"} · {formatDate(failure.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
