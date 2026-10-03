import { describe, expect, it } from "vitest";
import { ApiDebugEvent } from "../types/analytics";
import { isApiDebugError } from "./ApiDebugPanel";

const baseEvent: ApiDebugEvent = {
  id: "debug-1",
  timestamp: "2026-10-03T03:03:26.255Z",
  method: "GET",
  url: "https://analytics.example/api/v1/journeys/visitor/redacted",
};

describe("API debug error classification", () => {
  it("does not count an expected missing journey as an error", () => {
    expect(isApiDebugError({
      ...baseEvent,
      statusCode: 404,
      outcome: "expected_not_found",
    })).toBe(false);
  });

  it("continues to count unexpected HTTP and transport failures", () => {
    expect(isApiDebugError({ ...baseEvent, statusCode: 404 })).toBe(true);
    expect(isApiDebugError({ ...baseEvent, error: "Network unavailable" })).toBe(true);
  });
});
