import { describe, expect, it } from "vitest";
import { ApiDebugEvent } from "../types/analytics";
import { redactJourneyDebugEvent } from "./httpClient";

describe("journey Cloud Logging redaction", () => {
  it("redacts journey identities without mutating the local debug event", () => {
    const visitorId = "82fd7d6f-a30f-48aa-84df-fda8b77ce8ef";
    const cartId = "d3d1ec9e-99c2-4a59-bbb3-fac7f9ab0dd4";
    const analyticsKey = "a".repeat(64);
    const event: ApiDebugEvent = {
      id: "debug-1",
      timestamp: "2026-10-02T23:00:00Z",
      method: "GET",
      url: `https://analytics.example/api/v1/journeys/visitor/${visitorId}`,
      responseBody: {
        profile: {
          visitor_id: visitorId,
          cart_id: cartId,
          customer_id: 42,
          customer_analytics_key: analyticsKey,
          stage: "considering",
        },
        events: [{ event_id: "event-safe" }],
      },
      error: `Request for ${visitorId} and ${analyticsKey} failed`,
    };

    const redacted = redactJourneyDebugEvent(event);

    expect(redacted.url).toContain("/journeys/visitor/[redacted]");
    expect(redacted.responseBody).toEqual({
      profile: {
        visitor_id: "[redacted]",
        cart_id: "[redacted]",
        customer_id: "[redacted]",
        customer_analytics_key: "[redacted]",
        stage: "considering",
      },
      events: [{ event_id: "event-safe" }],
    });
    expect(redacted.error).not.toContain(visitorId);
    expect(redacted.error).not.toContain(analyticsKey);
    expect(event.responseBody).toMatchObject({
      profile: { visitor_id: visitorId, cart_id: cartId, customer_id: 42 },
    });
  });
});
