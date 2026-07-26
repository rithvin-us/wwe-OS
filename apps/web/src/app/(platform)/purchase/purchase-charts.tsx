"use client";

import { TrendingUp, Wallet } from "@bop/icons";

import { BarChartComponent, ChartCard, DonutChartComponent } from "@/components/charts";
import { mockData } from "@/lib/mock-data";

export function PurchaseCharts() {
  const vendorAnalysis = mockData.purchase.MOCK_VENDOR_SPEND_ANALYSIS;
  const trend = mockData.purchase.MOCK_PURCHASE_MONTHLY_TREND;

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
      >
        <DonutChartComponent
          data={vendorChartData}
          height={180}
          centerTitle="Top Vendor"
          centerValue="₹8.2L"
          valueFormat="currency"
        />
      </ChartCard>
    </div>
  );
}
