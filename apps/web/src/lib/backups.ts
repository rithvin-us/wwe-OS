import "server-only";

import { djangoFetch } from "@/lib/api/server";

/** Backup & recovery status — the application-side record of what the backup
 * infrastructure reported. Nothing here implies a backup exists unless a run
 * was recorded, and nothing is "verified" without a restore test. */
export interface BackupArea {
  kind: string;
  configured: boolean;
  status: "healthy" | "stale" | "not_configured";
  last_success_at: string | null;
  age_days: number | null;
  size_bytes?: number;
  location?: string;
  verified: boolean;
  verified_at?: string | null;
  last_attempt_status: string | null;
}

export interface BackupSummary {
  areas: BackupArea[];
  storage: { total_bytes: number; file_count: number };
  recent_failures: { kind: string; at: string; message: string }[];
}

export async function getBackupStatus(): Promise<BackupSummary> {
  return djangoFetch<BackupSummary>("/api/v1/backups/");
}

export const BACKUP_KIND_LABELS: Record<string, string> = {
  database: "Database",
  documents: "Documents / object storage",
  metadata: "Metadata",
};

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
