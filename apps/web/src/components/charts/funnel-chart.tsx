"use client";

import { CheckCircle2 } from "@bop/icons";

export interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
}

export interface FunnelChartProps {
  data: FunnelStep[];
}

export function FunnelChartComponent({ data }: FunnelChartProps) {
  return (
    <div className="space-y-3 py-2 w-full">
      {data.map((item, idx) => (
        <div key={item.step} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {item.step}
            </span>
            <span className="font-mono text-muted-foreground">
              <strong className="text-foreground font-semibold">{item.count}</strong> (
              {item.percentage}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-(--duration-slow) ease-out-quart"
              style={{ width: `${item.percentage}%`, opacity: 1 - idx * 0.15 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
