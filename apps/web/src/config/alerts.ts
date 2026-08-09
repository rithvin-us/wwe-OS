/** Alert rule types and constants — client-safe (no server-only imports),
 * shared between the automation page, its client components, and the
 * server-only fetchers in @/lib/alerts. */

export type AlertConditionType = "threshold" | "schedule";

export type AlertMetric =
  | "purchase_needs_attention_count"
  | "purchase_unpaid_count"
  | "contracts_expiring_count"
  | "operational_digest";

export type AlertOperator = "gt" | "gte" | "lt" | "lte";

export type AlertChannel = "telegram";

// Only these metrics resolve to a single number — the rest (the digest) is
// schedule-only. Kept in sync with platform/alerts/models.py THRESHOLD_METRICS.
export const THRESHOLD_METRICS: AlertMetric[] = [
  "purchase_needs_attention_count",
  "purchase_unpaid_count",
  "contracts_expiring_count",
];

export const METRIC_LABELS: Record<AlertMetric, string> = {
  purchase_needs_attention_count: "Purchase bills needing attention",
  purchase_unpaid_count: "Unpaid purchase bills",
  contracts_expiring_count: "Contracts expiring within 30 days",
  operational_digest: "Daily operational digest",
};

export const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
};

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  telegram: "Telegram",
};

export interface AlertRule {
  id: string;
  name: string;
  condition_type: AlertConditionType;
  metric: AlertMetric;
  operator: AlertOperator | "";
  threshold_value: string | null;
  schedule_time: string | null;
  channel: AlertChannel;
  message_template: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}
