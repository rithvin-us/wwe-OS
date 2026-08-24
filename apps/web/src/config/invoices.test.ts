import { describe, expect, it } from "vitest";

import {
  emptyLine,
  formatInvoiceDate,
  formatRupees,
  invoicePdfUrl,
  invoiceWorkbookUrl,
} from "./invoices";

describe("formatRupees", () => {
  it("formats numbers and numeric strings in en-IN with two decimals", () => {
    expect(formatRupees(1234.5)).toBe("₹1,234.50");
    expect(formatRupees("2500")).toBe("₹2,500.00");
    expect(formatRupees(0)).toBe("₹0.00");
  });

  it("treats an empty string as zero but non-numeric input as a blank", () => {
    expect(formatRupees("")).toBe("₹0.00");
    expect(formatRupees("abc")).toBe("—");
    expect(formatRupees(Number.NaN)).toBe("—");
  });
});

describe("formatInvoiceDate", () => {
  it("blanks an empty value rather than rendering 'Invalid Date'", () => {
    expect(formatInvoiceDate("")).toBe("—");
  });

  it("renders a real date with month and year", () => {
    const out = formatInvoiceDate("2026-08-24");
    expect(out).toContain("Aug");
    expect(out).toContain("2026");
  });
});

describe("invoice document URLs", () => {
  it("builds the workbook and pdf routes from the id", () => {
    expect(invoiceWorkbookUrl("42")).toBe("/api/finance/invoices/42/download");
    expect(invoicePdfUrl("42")).toBe("/api/finance/invoices/42/pdf");
  });
});

describe("emptyLine", () => {
  it("defaults a new invoice line to 1 Nos with blank money fields", () => {
    expect(emptyLine()).toEqual({
      description: "",
      hsn: "",
      quantity: "1",
      uom: "Nos",
      rate: "",
    });
  });
});
