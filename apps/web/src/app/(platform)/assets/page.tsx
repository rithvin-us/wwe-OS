import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { AssetsTable } from "@/app/(platform)/assets/assets-table";
import { CreateAssetDialog } from "@/app/(platform)/assets/create-dialog";
import { getAssetStats, getAssets } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Assets",
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

export default async function AssetsPage() {
  const [assets, stats] = await Promise.all([getAssets(), getAssetStats()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Assets"
        description="Track company equipment — what you own, who has it, its servicing, and its disposal."
        actions={<CreateAssetDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="In stock" value={stats.in_stock} />
        <StatTile label="Assigned" value={stats.assigned} />
        <StatTile label="In maintenance" value={stats.in_maintenance} />
        <StatTile label="Disposed" value={stats.disposed} />
      </div>

      <AssetsTable assets={assets} />
    </div>
  );
}
