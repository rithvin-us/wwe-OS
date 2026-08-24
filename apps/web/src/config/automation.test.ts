import { describe, expect, it } from "vitest";

import { automationRunSeries } from "./automation";

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

type Run = Parameters<typeof automationRunSeries>[0][number];
const run = (status: "success" | "failed", daysAgo: number): Run => ({
  status,
  started_at: isoDaysAgo(daysAgo),
  finished_at: isoDaysAgo(daysAgo),
});

describe("automationRunSeries", () => {
  it("returns a gap-free 7-day window, oldest first", () => {
    const series = automationRunSeries([]);
    expect(series).toHaveLength(7);
    expect(series.every((p) => p.successful === 0 && p.failed === 0)).toBe(true);
  });

  it("buckets successes and failures onto their day", () => {
    const series = automationRunSeries([
      run("success", 0),
      run("success", 0),
      run("failed", 0),
      run("success", 3),
    ]);
    const today = series[6];
    expect(today.successful).toBe(2);
    expect(today.failed).toBe(1);
    expect(series[3].successful).toBe(1);
  });

  it("ignores runs older than the window", () => {
    const series = automationRunSeries([run("success", 30)]);
    const total = series.reduce((sum, p) => sum + p.successful + p.failed, 0);
    expect(total).toBe(0);
  });
});
