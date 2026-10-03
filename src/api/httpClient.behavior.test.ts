import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushApiDebugEvent } = vi.hoisted(() => ({
  pushApiDebugEvent: vi.fn(),
}));

vi.mock("../debug/apiDebugStore", () => ({
  pushApiDebugEvent,
}));

describe("fetchJson diagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_ANALYTICS_API_BASE_URL", "https://analytics.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("records an expected journey 404 once without a transport-error event", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/diagnostics/frontend-event")) {
        return new Response(null, { status: 200 });
      }
      return new Response(JSON.stringify({
        detail: {
          code: "nya_journey_not_found",
          message: "Journey profile not found.",
        },
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }));

    const { ApiRequestError, fetchJson } = await import("./httpClient");

    await expect(fetchJson("/api/v1/journeys/visitor/visitor-1"))
      .rejects.toBeInstanceOf(ApiRequestError);
    expect(pushApiDebugEvent).toHaveBeenCalledTimes(1);
    const recordedEvent = pushApiDebugEvent.mock.calls[0][0];
    expect(recordedEvent).toEqual(expect.objectContaining({
      statusCode: 404,
      outcome: "expected_not_found",
    }));
    expect(recordedEvent.error).toBeUndefined();
  });
});
