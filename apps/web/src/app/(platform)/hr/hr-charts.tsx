"use client";

import { BarChart3, Clock, IndianRupee, Users } from "@bop/icons";

import {
  AreaChartComponent,
  BarChartComponent,
  ChartCard,
  DonutChartComponent,
} from "@/components/charts";
import { mockData } from "@/lib/mock-data";

export function HrCharts() {
  const deptHeadcount = mockData.hr.MOCK_DEPARTMENT_HEADCOUNT;
  const overtimeByDept = mockData.hr.MOCK_OVERTIME_BY_DEPT;
  const payrollBreakdown = mockData.hr.MOCK_PAYROLL_COST_BREAKDOWN;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* 1. Department Headcount & Attendance Bar Chart */}
      <ChartCard
        title="Department Attendance Rate"
        description="Attendance % across key departments"
        badge="Current Month"
        icon={Users}
      >
        <BarChartComponent
          data={deptHeadcount}
          xAxisKey="department"
          height={180}
          valueFormatter={(v) => `${v}%`}
          series={[{ key: "attendanceRate", name: "Attendance %", color: "var(--module-hr)" }]}
        />
      </ChartCard>

      {/* 2. Overtime Hours by Department Bar Chart */}
      <ChartCard
        title="Overtime Hours by Department"
        description="Recorded OT hours per department"
        badge="July 2026"
        icon={Clock}
      >
        <BarChartComponent
          data={overtimeByDept}
          xAxisKey="department"
          height={180}
          valueFormatter={(v) => `${v} hrs`}
          series={[{ key: "hours", name: "OT Hours", color: "var(--chart-3)" }]}
        />
      </ChartCard>

      {/* 3. Payroll Cost Breakdown Donut Chart */}
      <ChartCard
        title="Payroll Cost Structure"
        description="Wages, DA, OT & Statutory deductions split"
        badge="Projections"
        icon={IndianRupee}
      >
        <DonutChartComponent
          data={payrollBreakdown.map((p) => ({
            name: p.category,
            value: p.amount,
            color: p.color,
          }))}
          height={180}
          centerTitle="Total Gross"
          centerValue="₹7.07L"
          valueFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
        />
      </ChartCard>
    </div>
  );
}
