import { describe, expect, it } from "vitest";

import { formatMoney, formatQty } from "./inventory-constants";

describe("formatQty", () => {
  it("drops trailing decimals for whole numbers but keeps a real fraction", () => {
    expect(formatQty("5", "kg")).toBe("5 kg");
    expect(formatQty("5.0", "kg")).toBe("5 kg");
    expect(formatQty("5.5", "kg")).toBe("5.5 kg");
  });
});

describe("formatMoney", () => {
  it("blanks a missing value rather than showing a currency with nothing", () => {
    expect(formatMoney(null, "INR")).toBe("—");
    expect(formatMoney("", "INR")).toBe("—");
  });

  it("falls back to 'CUR value' when the value is not a number", () => {
    expect(formatMoney("N/A", "USD")).toBe("USD N/A");
  });

  it("formats a real amount (currency-formatted, not the raw fallback)", () => {
    const out = formatMoney("1500", "INR");
    expect(out).not.toBe("—");
    expect(out).not.toBe("INR 1500");
    expect(out).toMatch(/1,?500/);
  });
});
