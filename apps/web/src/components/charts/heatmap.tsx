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
  "bg-emerald-500/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
  "bg-emerald-500/40 border-emerald-500/50 text-emerald-900 dark:text-emerald-200",
  "bg-emerald-500/70 border-emerald-500/80 text-white",
  "bg-emerald-600 border-emerald-700 text-white font-bold",
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
