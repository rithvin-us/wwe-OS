import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { Send } from "@bop/icons";

import { BillsTable } from "@/app/(platform)/purchase/bills-table";
import { VendorsPanel } from "@/app/(platform)/purchase/vendors-panel";
import { getPurchaseBills, getPurchaseBillStats, getVendors } from "@/lib/purchase";

export const metadata: Metadata = {
  title: "Purchases",
};

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function PurchasePage() {
  const [bills, stats, vendors] = await Promise.all([
    getPurchaseBills(),
    getPurchaseBillStats(),
    getVendors(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases"
        description="Bills sent to the Telegram bot land here for you to confirm or reject."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Pending review" value={stats.pending_review} />
        <StatTile label="Confirmed" value={stats.confirmed} />
        <StatTile label="Rejected" value={stats.rejected} />
        <StatTile label="Awaiting payment" value={stats.unpaid_confirmed} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Send aria-hidden className="size-3.5" />
          Send a photo or PDF to the Telegram bot to add a bill here automatically.
        </div>
        <BillsTable bills={bills} />
      </section>

      <VendorsPanel vendors={vendors} />
    </div>
  );
}
