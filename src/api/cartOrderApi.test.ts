import { afterEach, describe, expect, it, vi } from "vitest";
import { createCartOrder } from "./cartOrderApi";
import * as httpClient from "./httpClient";

describe("createCartOrder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the cart order with Idempotency-Key", async () => {
    const fetchJson = vi.spyOn(httpClient, "fetchJson").mockResolvedValue({
      order_id: 9001,
      order_number: "9001",
      status: "pending",
      needs_payment: true,
      currency: "AUD",
      subtotal: 40,
      discount_total: 0,
      shipping_total: 0,
      fee_total: 12.5,
      tax_total: 5,
      total: 52.5,
      coupon_codes: ["SAVE10"],
      payment_url: "https://store.example/pay",
      admin_edit_url: "https://store.example/admin",
      cart_id: "11111111-2222-4333-8444-555555555555",
      created_via: "nya_chat_cart_order",
      fulfillment_excluded: true,
      stock_reduced_on_create: false,
      delivery_message: "Pay here",
      chat_delivery: { status: "delivered" },
    });

    await createCartOrder(
      "11111111-2222-4333-8444-555555555555",
      {
        coupon_code: "SAVE10",
        custom_shipping_inclusive: 12.5,
        deliver_via_chat: true,
        conversation_id: "conversation-1",
      },
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/carts/11111111-2222-4333-8444-555555555555/orders",
      {
        method: "POST",
        headers: { "Idempotency-Key": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
        body: JSON.stringify({
          coupon_code: "SAVE10",
          custom_shipping_inclusive: 12.5,
          deliver_via_chat: true,
          conversation_id: "conversation-1",
        }),
      },
    );
  });
});
