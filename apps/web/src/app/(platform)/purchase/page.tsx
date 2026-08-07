import type { Metadata } from "next";
import { PageHeader } from "@bop/ui/components/page-header";
import { Send, Wallet, FileText, AlertTriangle, TrendingUp } from "@bop/icons";

import { PurchasesViewToggle } from "@/app/(platform)/purchase/purchases-view-toggle";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  getPurchaseBills,
  getPurchaseBillStats,
  getPurchaseInsights,
  getVendors,
} from "@/lib/purchase";
import { listTags } from "@/lib/tags";

import { GstTaxBar } from "./gst-tax-bar";
import { PurchaseCharts } from "./purchase-charts";
import { PurchaseUploadCard } from "./purchase-upload-card";

export const metadata: Metadata = {
  title: "Purchases & AI Insights",
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

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

  const totalSpendFormatted = formatINR(insights?.overview?.total_spend || 0);
  const totalGstFormatted = formatINR(insights?.overview?.total_gst || 0);
  const duplicatesCount = insights?.duplicate_detection?.duplicates_count || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases & AI Insights"
        description="Digitized purchase records, automated OCR extraction, and spend intelligence."
      />

      <PurchaseUploadCard />

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

      {/* Visual Purchase & Spend Charts */}
      <PurchaseCharts
        vendorAnalysis={insights?.vendor_analysis || []}
        trend={insights?.monthly_spend?.map((m) => ({ month: m.period, spend: m.amount })) || []}
      />

      {/* GST Input Tax Credit Stacked Bar */}
      <GstTaxBar
        totalGst={insights?.overview?.total_gst || 0}
        cgst={insights?.gst_summary?.total_cgst || 0}
        sgst={insights?.gst_summary?.total_sgst || 0}
        igst={insights?.gst_summary?.total_igst || 0}
        billsCount={insights?.gst_summary?.bills_with_gst || 0}
      />

      {/* AI insights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard title="Vendor spend analysis" icon={Wallet}>
          {insights?.vendor_analysis?.length ? (
            <div className="space-y-2">
              {insights.vendor_analysis.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[140px]">
                    {v.name}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatINR(v.total_spend)} ({v.bills_count})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No vendor analysis available yet.</p>
          )}
        </SectionCard>

        <SectionCard title="GST & tax summary" icon={TrendingUp}>
          <p className="font-display text-xl font-semibold tabular-nums">{totalGstFormatted}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Claimable Input Tax Credit (ITC) across {insights?.gst_summary?.bills_with_gst || 0}{" "}
            bills.
          </p>
          {insights?.gst_summary ? (
            <div className="flex items-center gap-1.5 pt-2 flex-wrap text-[11px] font-mono">
              <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">
                CGST: {formatINR(insights.gst_summary.total_cgst || 0)}
              </span>
              <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">
                SGST: {formatINR(insights.gst_summary.total_sgst || 0)}
              </span>
              <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">
                IGST: {formatINR(insights.gst_summary.total_igst || 0)}
              </span>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Duplicate detection"
          icon={AlertTriangle}
          tone={duplicatesCount > 0 ? "warning" : "default"}
        >
          <p className="font-display text-xl font-semibold tabular-nums">{duplicatesCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {duplicatesCount === 0
              ? "No duplicate invoices detected."
              : "Duplicate invoices automatically flagged for review."}
          </p>
        </SectionCard>
      </div>

      <PurchasesViewToggle bills={bills} vendors={vendors} allTags={allTags} />
    </div>
  );
}
