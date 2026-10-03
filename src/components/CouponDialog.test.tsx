import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCoupon } from "../api/couponApi";
import CouponDialog from "./CouponDialog";

vi.mock("../api/couponApi", () => ({
  createCoupon: vi.fn(),
}));

describe("CouponDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates and delivers a customer-restricted coupon through linked chat", async () => {
    vi.mocked(createCoupon).mockResolvedValue({
      id: 7,
      code: "HELP10",
      discount_type: "percent",
      amount: 10,
      usage_limit: 1,
      expires_at: "2099-10-04T00:00:00.000Z",
      customer_restricted: true,
      delivery_message: "Use coupon code HELP10 at checkout for a 10% discount.",
      chat_delivery: { status: "delivered" },
    });

    const view = render(
      <CouponDialog
        customerId={42}
        cartId="cart-1"
        visitorId="visitor-1"
        conversationId="conversation-1"
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    fireEvent.change(view.getByRole("textbox", { name: /Unique coupon code/ }), {
      target: { value: "help10" },
    });
    fireEvent.change(view.getByRole("spinbutton", { name: /Percentage/ }), {
      target: { value: "10" },
    });
    fireEvent.change(view.getByLabelText(/Expires at/), {
      target: { value: "2099-10-04T00:00" },
    });
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));

    expect(await view.findByText("Coupon HELP10 created.")).toBeInTheDocument();
    expect(createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "HELP10",
        discount_type: "percent",
        amount: 10,
        usage_limit: 1,
        customer_id: 42,
        cart_id: "cart-1",
        visitor_id: "visitor-1",
        conversation_id: "conversation-1",
        deliver_via_chat: true,
      }),
      expect.any(String),
    );
  });
});
