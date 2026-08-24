import { describe, expect, it } from "vitest";

import { indexLabel } from "./search";

describe("indexLabel", () => {
  it("maps a known index to its human label", () => {
    expect(indexLabel("invoices")).toBe("Invoices");
    expect(indexLabel("employees")).toBe("Employees");
  });

  it("falls back to the raw key for an unknown index", () => {
    expect(indexLabel("mystery")).toBe("mystery");
  });
});
