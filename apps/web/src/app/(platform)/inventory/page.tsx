import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { CreateItemDialog } from "@/app/(platform)/inventory/create-dialog";
import { ItemsTable } from "@/app/(platform)/inventory/items-table";
import { InventoryDashboard } from "@/app/(platform)/inventory/inventory-dashboard";
import { getInventoryStats, getItems } from "@/lib/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

export default async function InventoryPage() {
  const [items, stats] = await Promise.all([getItems(), getInventoryStats()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track service tools, spare parts, and equipment assigned to service operations."
        actions={<CreateItemDialog />}
      />

      <InventoryDashboard items={items} stats={stats} />

      <ItemsTable items={items} />
    </div>
  );
}
