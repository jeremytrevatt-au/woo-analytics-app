import { describe, expect, it } from "vitest";
import { resolveStockAnalysisDateRange } from "./stockAnalysis";

describe("resolveStockAnalysisDateRange", () => {
  it("uses the selected analysis lookback when no explicit range is supplied", () => {
    expect(
      resolveStockAnalysisDateRange(365, null, null, new Date("2026-09-16T12:00:00Z")),
    ).toEqual({
      startDate: "2025-09-16",
      endDate: "2026-09-16",
    });
  });

  it("preserves an explicit analysis range", () => {
    expect(
      resolveStockAnalysisDateRange(
        365,
        "2026-08-17",
        "2026-09-16",
        new Date("2026-09-16T12:00:00Z"),
      ),
    ).toEqual({
      startDate: "2026-08-17",
      endDate: "2026-09-16",
    });
  });
});
