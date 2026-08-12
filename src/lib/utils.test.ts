import { describe, it, expect } from "vitest";
import { formatPrice, resolveSummaryDate } from "./utils";

describe("resolveSummaryDate", () => {
  it("passes through a well-formed date string", () => {
    expect(resolveSummaryDate("2026-08-20", "2026-08-12")).toBe(
      "2026-08-20",
    );
  });

  it("falls back to today for a non-date string", () => {
    expect(resolveSummaryDate("xyz", "2026-08-12")).toBe("2026-08-12");
  });

  it("falls back to today when the param is undefined", () => {
    expect(resolveSummaryDate(undefined, "2026-08-12")).toBe("2026-08-12");
  });

  it("falls back to today for a string that isn't a real calendar date", () => {
    expect(resolveSummaryDate("not-a-date", "2026-08-12")).toBe(
      "2026-08-12",
    );
  });
});

describe("formatPrice", () => {
  it("formats a plain dollar amount", () => {
    expect(formatPrice(12.5)).toBe("$12.50");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("adds a thousands separator the old .toFixed(2) call sites never had", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
  });

  it("rounds to two decimal places", () => {
    expect(formatPrice(4.999)).toBe("$5.00");
  });
});
