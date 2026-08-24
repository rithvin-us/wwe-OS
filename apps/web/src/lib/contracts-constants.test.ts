import { describe, expect, it } from "vitest";

import { formatDate, formatMoney } from "./contracts-constants";

describe("contracts formatMoney", () => {
  it("blanks null/empty and falls back to 'CUR value' for non-numeric input", () => {
    expect(formatMoney(null, "INR")).toBe("—");
    expect(formatMoney("", "INR")).toBe("—");
    expect(formatMoney("pending", "INR")).toBe("INR pending");
  });

  it("currency-formats a real amount", () => {
    const out = formatMoney("2500", "INR");
    expect(out).not.toBe("—");
    expect(out).toMatch(/2,?500/);
  });
});

describe("contracts formatDate", () => {
  it("blanks a null date and renders month + year for a real one", () => {
    expect(formatDate(null)).toBe("—");
    const out = formatDate("2026-08-24");
    expect(out).toContain("Aug");
    expect(out).toContain("2026");
  });
});
