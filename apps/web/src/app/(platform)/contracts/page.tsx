import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";

import { ContractsTable } from "@/app/(platform)/contracts/contracts-table";
import { CreateContractDialog } from "@/app/(platform)/contracts/create-dialog";
import { getContractStats, getContracts } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Contracts",
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

export default async function ContractsPage() {
  const [contracts, stats] = await Promise.all([getContracts(), getContractStats()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contracts"
        description="Track agreements, route them for approval, and get reminded before they expire."
        actions={<CreateContractDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Active" value={stats.active} />
        <StatTile label="Expiring soon" value={stats.expiring_soon} />
        <StatTile label="In review" value={stats.in_review} />
        <StatTile label="Draft" value={stats.draft} />
      </div>

      <ContractsTable contracts={contracts} />
    </div>
  );
}
