import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCoupon } from "./couponApi";
import { fetchJson } from "./httpClient";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

describe("couponApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockResolvedValue({});
  });

  it("posts the exact operator coupon request", async () => {
    const payload = {
      code: "HELP10",
      discount_type: "percent" as const,
      amount: 10,
      usage_limit: 1,
      expires_at: "2026-10-04T00:00:00.000Z",
      custom_message: "Thanks for considering Natural Yield.",
      customer_id: 42,
      cart_id: "cart-1",
      visitor_id: "visitor-1",
      conversation_id: "conversation-1",
      deliver_via_chat: true,
    };

    await createCoupon(payload, "coupon-request-123");

    expect(fetchJson).toHaveBeenCalledWith("/api/v1/coupons", {
      method: "POST",
      headers: { "Idempotency-Key": "coupon-request-123" },
      body: JSON.stringify(payload),
    });
  });
});
