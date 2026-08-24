import { describe, expect, it } from "vitest";

import {
  attendanceTrend,
  buildKpis,
  categoryBreakdown,
  currentPeriod,
  financialSummary,
  financialTrend,
  type LivePurchaseStats,
  monthlyAmountFor,
  spendTrend,
} from "./dashboard";

const purchase: LivePurchaseStats = { processed: 3, needsAttention: 1, total: 4, unpaid: 2 };

describe("financialSummary", () => {
  it("computes net and shows live outstanding receivables", () => {
    const rows = financialSummary({ revenueMonth: 100_000, expensesMonth: 40_000 }, 15_000);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel["Revenue (month)"]).toBe(100_000);
    expect(byLabel["Expenses (month)"]).toBe(40_000);
    expect(byLabel["Net (month)"]).toBe(60_000);
    expect(byLabel.Outstanding).toBe(15_000);
  });

  it("blanks net when either half is missing, and outstanding when omitted", () => {
    const rows = financialSummary({ revenueMonth: null, expensesMonth: 40_000 });
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel["Net (month)"]).toBeNull();
    expect(byLabel.Outstanding).toBeNull(); // never fabricated when the source is missing
  });
});

describe("attendanceTrend", () => {
  it("maps points to month + rate", () => {
    const points = [
      { label: "Jul 2026", attendance_pct: 92.5, working_units: 400 },
      { label: "Aug 2026", attendance_pct: 88, working_units: 410 },
    ];
    expect(attendanceTrend(points)).toEqual([
      { month: "Jul", attendanceRate: 92.5 },
      { month: "Aug", attendanceRate: 88 },
    ]);
  });

  it("returns empty for no data (all-zero working units) or a missing series", () => {
    expect(attendanceTrend([{ label: "Aug 2026", attendance_pct: 0, working_units: 0 }])).toEqual(
      [],
    );
    expect(attendanceTrend(null)).toEqual([]);
  });
});

describe("categoryBreakdown", () => {
  it("maps spend slices and drops zero-spend entries; null → empty", () => {
    expect(
      categoryBreakdown([
        { name: "Pipes", total_spend: 5000 },
        { name: "Valves", total_spend: 0 },
      ]),
    ).toEqual([{ name: "Pipes", value: 5000 }]);
    expect(categoryBreakdown(null)).toEqual([]);
  });
});

describe("buildKpis", () => {
  it("wires revenue/expenses live and ranks live tiles ahead of unwired", () => {
    const kpis = buildKpis(purchase, { revenueMonth: 250_000, expensesMonth: 90_000 });
    const revenue = kpis.find((k) => k.key === "revenue");
    expect(revenue?.value).toBe(250_000);
    expect(revenue?.status).toBe("live");
    // service-equipment has no backend yet → still unwired, sorted last.
    expect(kpis.at(-1)?.key).toBe("service-equipment");
  });

  it("marks a money KPI as error (not a live 0) when its source failed", () => {
    const kpis = buildKpis(purchase, { revenueMonth: null, expensesMonth: 90_000 });
    const revenue = kpis.find((k) => k.key === "revenue");
    expect(revenue?.value).toBeNull();
    expect(revenue?.status).toBe("error");
  });
});

describe("monthlyAmountFor", () => {
  const series = [
    { period: "2026-07", amount: 10 },
    { period: "2026-08", amount: 25 },
  ];

  it("returns the month's amount, a live 0 for a missing month, and null for a missing series", () => {
    expect(monthlyAmountFor(series, "2026-08")).toBe(25);
    expect(monthlyAmountFor(series, "2026-06")).toBe(0);
    expect(monthlyAmountFor(null, "2026-08")).toBeNull();
  });
});

describe("trend builders", () => {
  it("spendTrend labels periods and passes amounts through; null → empty", () => {
    expect(spendTrend([{ period: "2026-08", amount: 500 }])).toEqual([
      { month: "Aug", spend: 500 },
    ]);
    expect(spendTrend(null)).toEqual([]);
  });

  it("financialTrend merges both series by period, filling gaps with 0", () => {
    const merged = financialTrend(
      [{ period: "2026-08", amount: 300 }],
      [
        { period: "2026-07", amount: 100 },
        { period: "2026-08", amount: 200 },
      ],
    );
    expect(merged).toEqual([
      { month: "Jul", revenue: 0, expenses: 100 },
      { month: "Aug", revenue: 300, expenses: 200 },
    ]);
  });
});

describe("currentPeriod", () => {
  it("formats a date as YYYY-MM", () => {
    expect(currentPeriod(new Date(2026, 7, 24))).toBe("2026-08");
  });
});
