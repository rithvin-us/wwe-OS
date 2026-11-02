import { formatValue } from "@/config/dashboard";

export interface SpendRankingItem {
  name: string;
  value: number;
}

/**
 * Spend by item as a ranked list with thin bars — a share of a total reads
 * faster as a ranking than as a second chart the same size as the one above
 * it. The largest item carries the accent; the rest sit in neutral steps.
 */
export function SpendRanking({ items, limit = 5 }: { items: SpendRankingItem[]; limit?: number }) {
  const top = items.slice(0, limit);
  const max = Math.max(...top.map((item) => item.value), 1);

  return (
    <ol className="space-y-4">
      {top.map((item, index) => (
        <li key={item.name} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="min-w-0 truncate text-sm text-foreground">{item.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {formatValue(item.value, "currency")}
            </span>
          </div>
          <div className="h-1 w-full rounded-sm bg-muted">
            <div
              className={index === 0 ? "h-1 rounded-sm bg-chart-1" : "h-1 rounded-sm bg-chart-1/40"}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
