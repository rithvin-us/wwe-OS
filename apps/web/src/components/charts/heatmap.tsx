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
  "bg-muted/40 border-border/40",
  "bg-blue-500/20 border-blue-500/30 text-blue-800 dark:text-blue-300",
  "bg-blue-500/40 border-blue-500/50 text-blue-900 dark:text-blue-200",
  "bg-blue-500/70 border-blue-500/80 text-white",
  "bg-blue-600 border-blue-700 text-white font-bold",
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
              "flex aspect-square items-center justify-center rounded border text-[10px] font-mono transition-transform hover:scale-105 cursor-pointer",
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
