"use client";

import { TrendingUp, Wallet } from "@bop/icons";

import { BarChartComponent, ChartCard, DonutChartComponent } from "@/components/charts";
export interface PurchaseChartsProps {
  vendorAnalysis?: Array<{ name: string; total_spend: number }>;
  trend?: Array<{ month: string; spend: number }>;
}

export function PurchaseCharts({ vendorAnalysis = [], trend = [] }: PurchaseChartsProps) {
  const vendorChartData = vendorAnalysis.map((v) => ({
    name: v.name,
    value: v.total_spend,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      {/* 1. Monthly Purchase Spend Trend */}
      <ChartCard
        title="Monthly Spend Volume"
        description="Total purchase volume over 6 months"
        badge="6 Months"
        icon={TrendingUp}
        empty={trend.length === 0}
        emptyMessage="No purchase spend trend recorded yet."
      >
        <BarChartComponent
          data={trend}
          xAxisKey="month"
          height={180}
          valueFormat="currency"
          series={[{ key: "spend", name: "Spend", color: "var(--module-purchases)" }]}
        />
      </ChartCard>

      {/* 2. Top Vendor Spend Share */}
      <ChartCard
        title="Vendor Spend Distribution"
        description="Share of total spend by top vendors"
        badge="Top Vendors"
        icon={Wallet}
        empty={vendorChartData.length === 0}
        emptyMessage="No vendor spend distribution data available yet."
      >
        <DonutChartComponent
          data={vendorChartData}
          height={180}
          centerTitle="Top Vendor"
          centerValue={`${vendorChartData.length}`}
          valueFormat="currency"
        />
      </ChartCard>
    </div>
  );
}
