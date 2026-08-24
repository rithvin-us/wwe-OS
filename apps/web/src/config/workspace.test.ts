import { describe, expect, it } from "vitest";

import { actionPhrase } from "./workspace";

describe("actionPhrase", () => {
  it("strips the module prefix and turns separators into spaces", () => {
    expect(actionPhrase("finance.invoice_generated")).toBe("invoice generated");
    expect(actionPhrase("documents.uploaded")).toBe("uploaded");
    expect(actionPhrase("hr.leave.approved")).toBe("leave approved");
  });
});
