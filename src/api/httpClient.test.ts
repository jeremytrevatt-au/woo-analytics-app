import { describe, expect, it } from "vitest";
import { ApiDebugEvent } from "../types/analytics";
import {
  expectedApiOutcome,
  redactCouponDebugEvent,
  redactJourneyDebugEvent,
  redactReturnDebugEvent,
} from "./httpClient";

describe("expected API outcomes", () => {
  it("classifies only journey 404 responses as expected not-found outcomes", () => {
    expect(expectedApiOutcome("/api/v1/journeys/visitor/visitor-1", 404))
      .toBe("expected_not_found");
    expect(expectedApiOutcome("/api/v1/journeys/customer/42", 404))
      .toBe("expected_not_found");
    expect(expectedApiOutcome("/api/v1/journeys/visitor/visitor-1", 500))
      .toBeUndefined();
    expect(expectedApiOutcome("/api/v1/carts/cart-1", 404)).toBeUndefined();
  });
});

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

describe("coupon Cloud Logging redaction", () => {
  it("retains useful fields while removing coupon content and identities", () => {
    const event: ApiDebugEvent = {
      id: "debug-2",
      timestamp: "2026-10-03T01:00:00Z",
      method: "POST",
      url: "https://analytics.example/api/v1/coupons",
      requestBody: JSON.stringify({
        code: "HELP10",
        discount_type: "percent",
        amount: 10,
        customer_id: 42,
        cart_id: "cart-1",
        custom_message: "Private offer text",
      }),
      responseBody: {
        code: "HELP10",
        amount: 10,
        delivery_message: "Use HELP10",
        chat_delivery: { status: "sent" },
      },
    };

    const redacted = redactCouponDebugEvent(event);

    expect(redacted.requestBody).toEqual({
      code: "[redacted]",
      discount_type: "percent",
      amount: 10,
      customer_id: "[redacted]",
      cart_id: "[redacted]",
      custom_message: "[redacted]",
    });
    expect(redacted.responseBody).toEqual({
      code: "[redacted]",
      amount: 10,
      delivery_message: "[redacted]",
      chat_delivery: { status: "sent" },
    });
    expect(event.requestBody).toContain("HELP10");
  });
});

describe("return contact redaction", () => {
  it("removes email, phone, and street from return debug events", () => {
    const event: ApiDebugEvent = {
      id: "debug-3",
      timestamp: "2026-10-08T10:00:00Z",
      method: "POST",
      url: "https://analytics.example/api/v1/returns",
      requestBody: JSON.stringify({
        order_id: 134400,
        return_sender: {
          name: "Customer",
          email: "customer@example.test",
          phone: "0400000000",
          address_line_1: "10 Correct Street",
          suburb: "Googong",
          postcode: "2620",
        },
      }),
      responseBody: {
        order: {
          id: 134400,
          customer: { email: "customer@example.test" },
          shipping_address: {
            address_1: "1 Original Street",
            phone: "0400000000",
            suburb: "Sydney",
          },
        },
      },
      error: "Failed for customer@example.test at 0400000000",
    };

    const redacted = redactReturnDebugEvent(event);

    expect(redacted.requestBody).toEqual({
      order_id: 134400,
      return_sender: {
        name: "Customer",
        email: "[redacted]",
        phone: "[redacted]",
        address_line_1: "[redacted]",
        suburb: "Googong",
        postcode: "2620",
      },
    });
    expect(redacted.responseBody).toEqual({
      order: {
        id: 134400,
        customer: { email: "[redacted]" },
        shipping_address: {
          address_1: "[redacted]",
          phone: "[redacted]",
          suburb: "Sydney",
        },
      },
    });
    expect(redacted.error).not.toContain("customer@example.test");
    expect(redacted.error).not.toContain("0400000000");
    expect(event.requestBody).toContain("10 Correct Street");
  });
});
