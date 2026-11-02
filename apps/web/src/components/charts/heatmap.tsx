"use client";

import { cn } from "@bop/ui/lib/utils";

export interface HeatmapPoint {
  day: number;
  value: number; // 0 to 4 intensity scale
  label?: string;
}

export interface HeatmapProps {
  data: HeatmapPoint[];
  columns?: number;
}

const INTENSITY_COLORS = [
  "bg-muted border-border text-muted-foreground",
  "bg-chart-1/15 border-chart-1/25 text-foreground",
  "bg-chart-1/35 border-chart-1/45 text-foreground",
  "bg-chart-1/60 border-chart-1/70 text-foreground",
  "bg-chart-1 border-chart-1 text-background font-medium",
];

export function HeatmapComponent({ data, columns = 7 }: HeatmapProps) {
  return (
    <div
      className="grid gap-1.5 py-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {data.map((p) => {
        const colorClass = INTENSITY_COLORS[Math.min(p.value, 4)];
        return (
          <div
            key={p.day}
            title={p.label || `Day ${p.day}: Level ${p.value}`}
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center rounded-sm border font-mono text-xs tabular-nums transition-colors",
              colorClass,
            )}
          >
            {p.day}
          </div>
        );
      })}
    </div>
  );
}
