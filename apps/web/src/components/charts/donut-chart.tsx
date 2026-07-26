"use client";

import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  chartPalette,
} from "@bop/charts";

export interface DonutChartDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutChartDataItem[];
  height?: number;
  centerTitle?: string;
  centerValue?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valueFormatter?: (val: any) => string;
  valuePrefix?: string;
  valueSuffix?: string;
  valueFormat?: "number" | "currency" | "percent";
}

export function DonutChartComponent({
  data,
  height = 200,
  centerTitle,
  centerValue,
  valueFormatter,
  valuePrefix,
  valueSuffix,
  valueFormat,
}: DonutChartProps) {
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
    <div style={{ height }} className="relative flex items-center justify-center w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={68}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || chartPalette[index % chartPalette.length]}
              />
            ))}
          </Pie>
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
        </RechartsPieChart>
      </ResponsiveContainer>

      {(centerTitle || centerValue) && (
        <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
          {centerValue && (
            <span className="font-mono text-base font-bold text-foreground">{centerValue}</span>
          )}
          {centerTitle && (
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
              {centerTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
