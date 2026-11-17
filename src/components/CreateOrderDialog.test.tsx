import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCartOrder } from "../api/cartOrderApi";
import CreateOrderDialog from "./CreateOrderDialog";

vi.mock("../api/cartOrderApi", () => ({
  createCartOrder: vi.fn(),
}));

vi.mock("../api/couponApi", () => ({
  createCoupon: vi.fn(),
}));

const cart = {
  cart_id: "11111111-2222-4333-8444-555555555555",
  visitor_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  customer_id: 42,
  is_marketing_eligible: true,
  sequence: 3,
  status: "active" as const,
  updated_at: "2026-09-28T10:00:00Z",
  currency: "AUD",
  item_count: 1,
  subtotal: 20,
  discount_total: 0,
  shipping_total: 0,
  tax_total: 2,
  total: 22,
  order_id: null,
  lines: [{
    id: 1,
    product_id: 10,
    variation_id: 0,
    sku: "TEA-1",
    product_name: "Test Tea",
    quantity: 1,
    unit_total: 20,
    line_subtotal: 20,
    line_total: 20,
    metadata: {},
  }],
};

describe("CreateOrderDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates a pending order and offers the pay link", async () => {
    const user = userEvent.setup();
    vi.mocked(createCartOrder).mockResolvedValue({
      order_id: 9001,
      order_number: "9001",
      status: "pending",
      needs_payment: true,
      currency: "AUD",
      subtotal: 20,
      discount_total: 0,
      shipping_total: 0,
      fee_total: 11,
      tax_total: 3,
      total: 34,
      coupon_codes: [],
      payment_url: "https://store.example/checkout/order-pay/9001/?key=wc_order_SECRET",
      admin_edit_url: "https://store.example/wp-admin/order/9001",
      cart_id: cart.cart_id,
      created_via: "nya_chat_cart_order",
      fulfillment_excluded: true,
      stock_reduced_on_create: false,
      delivery_message: "Pay for order #9001 here: https://store.example/pay",
      hold_stock_minutes: 0,
      chat_delivery: { status: "delivered" },
    });

    render(
      <CreateOrderDialog
        cart={cart}
        conversationId="conversation-1"
        restrictEmail="buyer@example.com"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create order" }));
    await user.type(screen.getByLabelText(/Custom shipping/i), "11");
    await user.click(screen.getByRole("button", { name: "Create pending order" }));

    await waitFor(() => {
      expect(createCartOrder).toHaveBeenCalled();
    });
    expect(createCartOrder).toHaveBeenCalledWith(
      cart.cart_id,
      expect.objectContaining({
        custom_shipping_inclusive: 11,
        deliver_via_chat: true,
        conversation_id: "conversation-1",
        customer_id: 42,
      }),
      expect.any(String),
    );
    expect(await screen.findByDisplayValue(/order-pay\/9001/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy pay link" })).toBeTruthy();
  });
});
