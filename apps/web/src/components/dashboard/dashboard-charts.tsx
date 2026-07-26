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
import { mockData } from "@/lib/mock-data";

export interface DashboardChartsProps {
  loading?: boolean;
  error?: string | null;
}

export function DashboardCharts({ loading = false, error = null }: DashboardChartsProps) {
  const financialTrend = mockData.dashboard.MOCK_FINANCIAL_TREND;
  const spendTrend = mockData.dashboard.MOCK_SPEND_TREND;
  const attendanceTrend = mockData.dashboard.MOCK_ATTENDANCE_TREND;
  const categoryBreakdown = mockData.dashboard.MOCK_CATEGORY_BREAKDOWN;
  const processFunnel = mockData.dashboard.MOCK_PROCESS_FUNNEL;

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
        description="Spend distribution by item category"
        badge="Jul 2026"
        icon={PieChartIcon}
        loading={loading}
        error={error}
        empty={categoryBreakdown.length === 0}
      >
        <DonutChartComponent
          data={categoryBreakdown}
          height={190}
          centerTitle="Total Categories"
          centerValue={`${categoryBreakdown.length}`}
          valueSuffix="%"
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
        className="md:col-span-2 lg:col-span-2"
      >
        <FunnelChartComponent data={processFunnel} />
      </ChartCard>
    </div>
  );
}
