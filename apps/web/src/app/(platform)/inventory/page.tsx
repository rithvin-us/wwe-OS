import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { CreateItemDialog } from "@/app/(platform)/inventory/create-dialog";
import { ItemsTable } from "@/app/(platform)/inventory/items-table";
import { getInventoryStats, getItems } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function InventoryPage() {
  const [items, stats] = await Promise.all([getItems(), getInventoryStats()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        description="Track stock levels, record receipts and issues, and get alerted before you run low."
        actions={<CreateItemDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Active items" value={stats.active} />
        <StatTile label="Low stock" value={stats.low_stock} />
        <StatTile label="Inactive" value={stats.inactive} />
        <StatTile label="Total items" value={stats.total_items} />
      </div>

      <ItemsTable items={items} />
    </div>
  );
}
