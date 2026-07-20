/**
 * Chart layer. All charts in the platform use these themed primitives so every
 * visualization shares the same categorical palette (design-system chart tokens).
 * No chart may hardcode a color.
 */
export * from "recharts";

/** Categorical series palette — resolves to design-system tokens. */
export const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
