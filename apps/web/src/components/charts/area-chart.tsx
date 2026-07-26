"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@bop/charts";

import { type ChartDataRecord } from "./types";

export interface AreaChartSeries {
  key: string;
  name: string;
  color?: string;
}

export interface AreaChartProps {
  data: ChartDataRecord[];
  xAxisKey: string;
  series: AreaChartSeries[];
  height?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valueFormatter?: (val: any) => string;
  valuePrefix?: string;
  valueSuffix?: string;
  valueFormat?: "number" | "currency" | "percent";
}

export function AreaChartComponent({
  data,
  xAxisKey,
  series,
  height = 200,
  valueFormatter,
  valuePrefix,
  valueSuffix,
  valueFormat,
}: AreaChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatVal = (val: any) => {
    if (valueFormatter) return valueFormatter(val);
    const num = Number(val || 0);
    if (valueFormat === "currency") return `₹${num.toLocaleString("en-IN")}`;
    if (valueFormat === "percent") return `${num}%`;
    const str = isNaN(num) ? String(val ?? "") : num.toLocaleString("en-IN");
    return `${valuePrefix || ""}${str}${valueSuffix ? ` ${valueSuffix}` : ""}`;
  };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {series.map((s, idx) => {
              const color = s.color || `var(--chart-${(idx % 5) + 1})`;
              return (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [formatVal(value), String(name)]}
          />
          {series.map((s, idx) => {
            const color = s.color || `var(--chart-${(idx % 5) + 1})`;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${s.key})`}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
