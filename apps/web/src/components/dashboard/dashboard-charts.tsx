"use client";

import { BarChart3, LineChart, PieChart as PieChartIcon, TrendingUp, Workflow } from "@bop/icons";

import {
  AreaChartComponent,
  BarChartComponent,
  ChartCard,
  DonutChartComponent,
  FunnelChartComponent,
  LineChartComponent,
} from "@/components/charts";

export interface DashboardChartsProps {
  loading?: boolean;
  error?: string | null;
  financialTrend?: Array<{ month: string; revenue: number; expenses: number }>;
  spendTrend?: Array<{ month: string; spend: number }>;
  attendanceTrend?: Array<{ month: string; attendanceRate: number }>;
  categoryBreakdown?: Array<{ name: string; value: number; color?: string }>;
  processFunnel?: Array<{ step: string; count: number; percentage: number }>;
}

export function DashboardCharts({
  loading = false,
  error = null,
  financialTrend = [],
  spendTrend = [],
  attendanceTrend = [],
  categoryBreakdown = [],
  processFunnel = [],
}: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* 1. Revenue vs Expenses Line Chart */}
      <ChartCard
        title="Revenue vs Expenses"
        description="6-month financial performance trend"
        badge="6 Months"
        icon={LineChart}
        loading={loading}
        error={error}
        empty={financialTrend.length === 0}
        emptyMessage="No financial performance data recorded yet."
      >
        <LineChartComponent
          data={financialTrend}
          xAxisKey="month"
          height={190}
          valueFormat="currency"
          series={[
            { key: "revenue", name: "Revenue", color: "var(--chart-2)" },
            { key: "expenses", name: "Expenses", color: "var(--chart-5)" },
          ]}
        />
      </ChartCard>

      {/* 2. Procurement & Spend Bar Chart */}
      <ChartCard
        title="Procurement & Spend"
        description="Monthly bill spend volume"
        badge="Monthly"
        icon={TrendingUp}
        loading={loading}
        error={error}
        empty={spendTrend.length === 0}
        emptyMessage="No procurement spend recorded yet."
      >
        <BarChartComponent
          data={spendTrend}
          xAxisKey="month"
          height={190}
          valueFormat="currency"
          series={[{ key: "spend", name: "Spend Amount", color: "var(--module-dashboard)" }]}
        />
      </ChartCard>

      {/* 3. Attendance Rate Area Chart */}
      <ChartCard
        title="Attendance & OT Hours"
        description="Workforce presence percentage"
        badge="Monthly %"
        icon={BarChart3}
        loading={loading}
        error={error}
        empty={attendanceTrend.length === 0}
        emptyMessage="No attendance logs recorded yet."
      >
        <AreaChartComponent
          data={attendanceTrend}
          xAxisKey="month"
          height={190}
          valueSuffix="%"
          series={[{ key: "attendanceRate", name: "Attendance %", color: "var(--module-hr)" }]}
        />
      </ChartCard>

      {/* 4. Category Breakdown Donut Chart */}
      <ChartCard
        title="Procurement Categories"
        description="Spend distribution across top purchased items"
        badge="By item"
        icon={PieChartIcon}
        loading={loading}
        error={error}
        empty={categoryBreakdown.length === 0}
        emptyMessage="No itemised purchase spend recorded yet."
      >
        <DonutChartComponent
          data={categoryBreakdown}
          height={190}
          centerTitle="Top items"
          centerValue={`${categoryBreakdown.length}`}
          valueFormat="currency"
        />
      </ChartCard>

      {/* 5. Document Processing Funnel */}
      <ChartCard
        title="Bill Digitization Funnel"
        description="Document extraction to ledger posting"
        badge="Pipeline"
        icon={Workflow}
        loading={loading}
        error={error}
        empty={processFunnel.length === 0}
        emptyMessage="No bill extraction activity in pipeline yet."
        className="md:col-span-2 lg:col-span-2"
      >
        <FunnelChartComponent data={processFunnel} />
      </ChartCard>
    </div>
  );
}
