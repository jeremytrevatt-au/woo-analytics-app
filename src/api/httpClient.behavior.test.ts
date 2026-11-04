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

  it("surfaces AbortError as Request aborted instead of Failed to fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const abortError = new Error("The user aborted a request.");
      abortError.name = "AbortError";
      throw abortError;
    }));

    const { fetchJson } = await import("./httpClient");

    await expect(fetchJson("/api/v1/chat/inbox")).rejects.toMatchObject({
      name: "AbortError",
      message: "Request aborted",
    });
    expect(pushApiDebugEvent).toHaveBeenCalledTimes(1);
    expect(pushApiDebugEvent.mock.calls[0][0].error).toBe("The user aborted a request.");
    expect(pushApiDebugEvent.mock.calls[0][0].statusCode).toBeUndefined();
  });

  it("reloads once for a same-origin Failed to fetch with no statusCode", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      href: "https://analytics.example/chat",
      origin: "https://analytics.example",
      pathname: "/chat",
      search: "",
      hash: "",
      assign,
    });
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const { fetchJson } = await import("./httpClient");

    await expect(fetchJson("/api/v1/chat/inbox")).rejects.toThrow(
      "Failed to fetch from the analytics API (possible IAP expiry; reloading for Google login).",
    );
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/chat");
    expect(pushApiDebugEvent).toHaveBeenCalledTimes(1);
    expect(pushApiDebugEvent.mock.calls[0][0]).toEqual(expect.objectContaining({
      error: "Failed to fetch",
    }));
    expect(pushApiDebugEvent.mock.calls[0][0].statusCode).toBeUndefined();

    await expect(fetchJson("/api/v1/chat/inbox")).rejects.toThrow(
      "Failed to fetch from the analytics API (possible IAP expiry; a document reload was already attempted this session).",
    );
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
