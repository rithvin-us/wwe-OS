import { Boxes, PackageCheck, CircleDollarSign, AlertCircle } from "@bop/icons";
import { formatMoney, type InventoryItemRecord } from "@/lib/inventory-constants";

export function InventoryDashboard({
  items,
  stats,
}: {
  items: InventoryItemRecord[];
  stats: { total_items: number; active: number; inactive: number };
}) {
  const totalValuation = items.reduce((acc, item) => acc + (Number(item.stock_value) || 0), 0);
  const currency = items[0]?.currency || "INR";
  const formattedValuation = formatMoney(totalValuation.toFixed(2), currency);

  const outOfStockCount = items.filter((i) => (Number(i.quantity_on_hand) || 0) <= 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Items */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Tools & Parts
            </span>
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {stats.total_items}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Equipment</span>
          </div>
        </div>

        {/* Active Stock Items */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Active Equipment
            </span>
            <PackageCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {stats.active}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {stats.total_items > 0 ? Math.round((stats.active / stats.total_items) * 100) : 0}% active
            </span>
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Asset Valuation
            </span>
            <CircleDollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {formattedValuation}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Value</span>
          </div>
        </div>

        {/* Out of Stock */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
              Depleted Parts
            </span>
            <AlertCircle className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {outOfStockCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">0 Quantity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
