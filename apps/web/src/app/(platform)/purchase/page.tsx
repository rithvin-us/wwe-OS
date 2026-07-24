import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { Send, Zap, FileText, AlertTriangle, TrendingUp } from "@bop/icons";

import { BillsTable } from "@/app/(platform)/purchase/bills-table";
import { VendorsPanel } from "@/app/(platform)/purchase/vendors-panel";
import {
  getPurchaseBills,
  getPurchaseBillStats,
  getPurchaseInsights,
  getVendors,
} from "@/lib/purchase";
import { listTags } from "@/lib/tags";

export const metadata: Metadata = {
  title: "Purchases & AI Insights",
};

function StatTile({
  label,
  value,
  subtext,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        {Icon && <Icon aria-hidden className="size-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

export default async function PurchasePage() {
  const [bills, stats, insights, vendors, allTags] = await Promise.all([
    getPurchaseBills(),
    getPurchaseBillStats(),
    getPurchaseInsights(),
    getVendors(),
    listTags(),
  ]);

  const totalSpendFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(insights?.overview?.total_spend || 0);

  const totalGstFormatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(insights?.overview?.total_gst || 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases & AI Insights"
        description="Digitized purchase records, automated OCR extraction, and spend intelligence."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Processed" value={stats.processed} icon={FileText} />
        <StatTile
          label="Needs Attention"
          value={stats.needs_attention}
          subtext={stats.needs_attention > 0 ? "Requires manual verification" : "All clear"}
          icon={AlertTriangle}
        />
        <StatTile label="Unpaid Purchases" value={stats.unpaid} icon={Send} />
        <StatTile label="Total Digitized Spend" value={totalSpendFormatted} icon={TrendingUp} />
      </div>

      {/* AI Insights Widget Panel */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <h3 className="font-medium text-sm">Vendor Spend Analysis</h3>
          </div>
          <div className="space-y-2">
            {insights?.vendor_analysis?.length ? (
              insights.vendor_analysis.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[140px]">
                    {v.name}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    ${v.total_spend.toFixed(2)} ({v.bills_count})
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No vendor analysis available yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-500" />
            <h3 className="font-medium text-sm">GST & Tax Summary</h3>
          </div>
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold tabular-nums">{totalGstFormatted}</p>
            <p className="text-xs text-muted-foreground">
              Claimable tax across {insights?.gst_summary?.bills_with_gst || 0} bills with GST IDs.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-500" />
            <h3 className="font-medium text-sm">Duplicate Detection</h3>
          </div>
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold tabular-nums">
              {insights?.duplicate_detection?.duplicates_count || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              {insights?.duplicate_detection?.duplicates_count === 0
                ? "No duplicate invoices detected."
                : "Duplicate invoices automatically flagged for review."}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Send aria-hidden className="size-3.5" />
          Send a receipt photo or PDF to the Telegram bot to digitize it automatically.
        </div>
        <BillsTable bills={bills} allTags={allTags} />
      </section>

      <VendorsPanel vendors={vendors} />
    </div>
  );
}
