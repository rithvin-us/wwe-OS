"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@bop/charts";

export type ChartDataRecord = Record<string, string | number | boolean | null | undefined>;

export interface BarChartSeries {
  key: string;
  name: string;
  color?: string;
  stackId?: string;
}

export interface BarChartProps {
  data: ChartDataRecord[];
  xAxisKey: string;
  series: BarChartSeries[];
  height?: number;
  valueFormatter?: (val: string | number | boolean | null | undefined) => string;
}

export function BarChartComponent({
  data,
  xAxisKey,
  series,
  height = 200,
  valueFormatter = (v) => `${v}`,
}: BarChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
            opacity={0.5}
          />
          <XAxis
            dataKey={xAxisKey}
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
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            formatter={(value: unknown, name: unknown) => [valueFormatter(value), String(name)]}
          />
          {series.map((s, idx) => {
            const color = s.color || `var(--chart-${(idx % 5) + 1})`;
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={color}
                stackId={s.stackId}
                radius={s.stackId ? undefined : [4, 4, 0, 0]}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
