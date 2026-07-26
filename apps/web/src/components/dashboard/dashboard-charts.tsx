"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  chartPalette,
} from "@bop/charts";
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from "@bop/icons";

interface DashboardChartsProps {
  purchaseCount?: number;
}

const MONTHLY_SPEND_DATA = [
  { month: "Feb", spend: 42000, bills: 12 },
  { month: "Mar", spend: 68000, bills: 18 },
  { month: "Apr", spend: 55000, bills: 15 },
  { month: "May", spend: 89000, bills: 24 },
  { month: "Jun", spend: 72000, bills: 19 },
  { month: "Jul", spend: 94500, bills: 28 },
];

const ATTENDANCE_TREND_DATA = [
  { month: "Feb", attendance: 92, otHours: 45 },
  { month: "Mar", attendance: 95, otHours: 62 },
  { month: "Apr", attendance: 91, otHours: 38 },
  { month: "May", attendance: 96, otHours: 78 },
  { month: "Jun", attendance: 94, otHours: 54 },
  { month: "Jul", attendance: 98, otHours: 85 },
];

const CATEGORY_BREAKDOWN = [
  { name: "Pipes & Fittings", value: 38, color: "var(--chart-1)" },
  { name: "Valves & Controls", value: 25, color: "var(--chart-2)" },
  { name: "Electrical & Motors", value: 18, color: "var(--chart-3)" },
  { name: "Civil & Fabrication", value: 12, color: "var(--chart-4)" },
  { name: "Consumables & Tools", value: 7, color: "var(--chart-5)" },
];

export function DashboardCharts({ purchaseCount = 5 }: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Procurement & Spend Trend */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Procurement & Spend Trend
            </h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
            6 Months
          </span>
        </div>
        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={MONTHLY_SPEND_DATA}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [
                  `₹${Number(value || 0).toLocaleString("en-IN")}`,
                  "Spend",
                ]}
              />
              <Bar dataKey="spend" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Workforce & Attendance Trend */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Attendance & OT Hours
            </h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
            Monthly %
          </span>
        </div>
        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={ATTENDANCE_TREND_DATA}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[80, 100]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`${value}%`, "Attendance Rate"]}
              />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#attendanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown Donut */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs md:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Procurement Category Split
            </h3>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
            Jul 2026
          </span>
        </div>
        <div className="flex items-center justify-center h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={CATEGORY_BREAKDOWN}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {CATEGORY_BREAKDOWN.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`${value}%`, "Share"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
