"use client";

import { BarChart3, LineChart, PieChart as PieChartIcon, TrendingUp } from "@bop/icons";

import {
  AreaChartComponent,
  BarChartComponent,
  ChartCard,
  LineChartComponent,
} from "@/components/charts";
import { SpendRanking } from "@/components/dashboard/spend-ranking";

/** Series colours come from the chart ramp only (design bible §3). Revenue
 * leads in the first chart colour; every other series on the dashboard sits
 * in a quieter step of the same ramp, so one line is clearly the subject. */
const REVENUE_COLOR = "var(--chart-1)";
const EXPENSES_COLOR = "var(--chart-5)";

export interface DashboardChartsProps {
  loading?: boolean;
  error?: string | null;
  financialTrend?: Array<{ month: string; revenue: number; expenses: number }>;
  spendTrend?: Array<{ month: string; spend: number }>;
  attendanceTrend?: Array<{ month: string; attendanceRate: number }>;
  categoryBreakdown?: Array<{ name: string; value: number; color?: string }>;
}

/** Square swatch + mono label — the instrument-panel legend used wherever a
 * dashboard chart carries more than one series. */
function Legend({ series }: { series: Array<{ name: string; color: string }> }) {
  return (
    <ul className="flex items-center gap-4">
      {series.map((item) => (
        <li
          key={item.name}
          className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
        >
          <span aria-hidden className="size-2 shrink-0" style={{ backgroundColor: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export function DashboardCharts({
  loading = false,
  error = null,
  financialTrend = [],
  spendTrend = [],
  attendanceTrend = [],
  categoryBreakdown = [],
}: DashboardChartsProps) {
  return (
    <div className="space-y-4">
      {/* The dashboard's one main instrument: money in against money out,
          full width and taller than anything else that plots data. */}
      <ChartCard
        title="Revenue and expenses"
        description="Last 6 months, from invoices and purchase bills"
        icon={LineChart}
        action={
          <Legend
            series={[
              { name: "Revenue", color: REVENUE_COLOR },
              { name: "Expenses", color: EXPENSES_COLOR },
            ]}
          />
        }
        loading={loading}
        error={error}
        empty={financialTrend.length === 0}
        emptyMessage="No invoiced revenue or bill spend recorded yet."
      >
        <LineChartComponent
          data={financialTrend}
          xAxisKey="month"
          height={300}
          valueFormat="currency"
          series={[
            { key: "revenue", name: "Revenue", color: REVENUE_COLOR },
            { key: "expenses", name: "Expenses", color: EXPENSES_COLOR },
          ]}
        />
      </ChartCard>

      {/* Supporting figures: each smaller than the main chart, and each a
          different kind of read — bars, a rate over time, a ranking. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title="Monthly spend"
          description="Purchase bills per month"
          icon={TrendingUp}
          className="lg:col-span-5"
          loading={loading}
          error={error}
          empty={spendTrend.length === 0}
          emptyMessage="No purchase spend recorded yet."
        >
          <BarChartComponent
            data={spendTrend}
            xAxisKey="month"
            height={180}
            valueFormat="currency"
            series={[{ key: "spend", name: "Spend", color: REVENUE_COLOR }]}
          />
        </ChartCard>

        <ChartCard
          title="Attendance rate"
          description="Share of working time present"
          icon={BarChart3}
          className="lg:col-span-4"
          loading={loading}
          error={error}
          empty={attendanceTrend.length === 0}
          emptyMessage="No attendance recorded yet."
        >
          <AreaChartComponent
            data={attendanceTrend}
            xAxisKey="month"
            height={180}
            valueSuffix="%"
            series={[{ key: "attendanceRate", name: "Attendance", color: REVENUE_COLOR }]}
          />
        </ChartCard>

        <ChartCard
          title="Spend by item"
          description="Largest purchased items"
          icon={PieChartIcon}
          className="lg:col-span-3"
          loading={loading}
          error={error}
          empty={categoryBreakdown.length === 0}
          emptyMessage="No itemised purchase spend recorded yet."
        >
          <SpendRanking items={categoryBreakdown} />
        </ChartCard>
      </div>
    </div>
  );
}
