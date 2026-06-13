import { describe, expect, it } from "vitest";
import { formatCurrency, formatNumber, summarizeDelta } from "./format";

describe("format helpers", () => {
  it("formats currency in AUD", () => {
    expect(formatCurrency(12345)).toContain("$12,345");
  });

  it("formats integer values", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats positive and negative deltas", () => {
    expect(summarizeDelta(3.25)).toBe("+3.3%");
    expect(summarizeDelta(-2.31)).toBe("-2.3%");
  });
});
