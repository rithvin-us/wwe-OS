"use client";

import { Clock, IndianRupee, Users } from "@bop/icons";

import { BarChartComponent, ChartCard, DonutChartComponent } from "@/components/charts";
export interface HrChartsProps {
  deptHeadcount?: Array<{ department: string; attendanceRate: number }>;
  overtimeByDept?: Array<{ department: string; hours: number }>;
  payrollBreakdown?: Array<{ category: string; amount: number; color?: string }>;
}

export function HrCharts({
  deptHeadcount = [],
  overtimeByDept = [],
  payrollBreakdown = [],
}: HrChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* 1. Department Headcount & Attendance Bar Chart */}
      <ChartCard
        title="Department Attendance Rate"
        description="Attendance % across key departments"
        badge="Current Month"
        icon={Users}
        empty={deptHeadcount.length === 0}
        emptyMessage="No department attendance data recorded yet."
      >
        <BarChartComponent
          data={deptHeadcount}
          xAxisKey="department"
          height={180}
          valueSuffix="%"
          series={[{ key: "attendanceRate", name: "Attendance %", color: "var(--module-hr)" }]}
        />
      </ChartCard>

      {/* 2. Overtime Hours by Department Bar Chart */}
      <ChartCard
        title="Overtime Hours by Department"
        description="Recorded OT hours per department"
        badge="Monthly OT"
        icon={Clock}
        empty={overtimeByDept.length === 0}
        emptyMessage="No overtime hours logged for this period."
      >
        <BarChartComponent
          data={overtimeByDept}
          xAxisKey="department"
          height={180}
          valueSuffix="hrs"
          series={[{ key: "hours", name: "OT Hours", color: "var(--chart-3)" }]}
        />
      </ChartCard>

      {/* 3. Payroll Cost Breakdown Donut Chart */}
      <ChartCard
        title="Payroll Cost Structure"
        description="Wages, DA, OT & Statutory deductions split"
        badge="Payroll"
        icon={IndianRupee}
        empty={payrollBreakdown.length === 0}
        emptyMessage="No payroll calculation data available yet."
      >
        <DonutChartComponent
          data={payrollBreakdown.map((p) => ({
            name: p.category,
            value: p.amount,
            color: p.color,
          }))}
          height={180}
          centerTitle="Total Gross"
          centerValue={`${payrollBreakdown.reduce((sum, p) => sum + p.amount, 0)}`}
          valueFormat="currency"
        />
      </ChartCard>
    </div>
  );
}
