// Client-safe notification types + helpers. No server-only imports.

export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationBucket =
  | "critical"
  | "action_required"
  | "informational"
  | "completed";

export interface NotificationRecord {
  id: string;
  category: string;
  priority: NotificationPriority;
  bucket: NotificationBucket;
  channel: string;
  status: NotificationStatus;
  title: string;
  body: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

/** Operator-facing categories the Notification Center groups by. Order is the
 * order the tabs render in — most urgent first. */
export const NOTIFICATION_BUCKETS: NotificationBucket[] = [
  "critical",
  "action_required",
  "informational",
  "completed",
];

export const BUCKET_LABELS: Record<NotificationBucket, string> = {
  critical: "Critical",
  action_required: "Action required",
  informational: "Informational",
  completed: "Completed",
};

/** Badge variant per bucket, using the design-system token variants only. */
export const BUCKET_BADGE_VARIANT: Record<
  NotificationBucket,
  "destructive" | "warning" | "secondary" | "success"
> = {
  critical: "destructive",
  action_required: "warning",
  informational: "secondary",
  completed: "success",
};

/** Where clicking a notification should take the operator, derived from the
 * publishing module's category + the ids it attached. */
export function notificationHref(n: NotificationRecord): string | null {
  const data = n.data ?? {};
  switch (n.category) {
    case "documents":
      return data.document_id ? `/dms/${data.document_id}` : "/dms";
    case "contracts":
      return data.contract_id ? `/contracts/${data.contract_id}` : "/contracts";
    case "inventory":
      return data.item_id ? `/inventory/${data.item_id}` : "/inventory";
    case "assets":
      return data.asset_id ? `/assets/${data.asset_id}` : "/assets";
    case "purchase":
      return "/purchase";
    default:
      return null;
  }
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
