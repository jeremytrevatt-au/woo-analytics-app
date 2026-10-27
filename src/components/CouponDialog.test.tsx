import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCoupon } from "../api/couponApi";
import { getCustomerContact } from "../api/customerContactApi";
import CouponDialog from "./CouponDialog";

vi.mock("../api/couponApi", () => ({
  createCoupon: vi.fn(),
}));

vi.mock("../api/customerContactApi", () => ({
  getCustomerContact: vi.fn(),
}));

function submitButton(view: ReturnType<typeof render>) {
  const buttons = view.getAllByRole("button", { name: "Create coupon" });
  return buttons[buttons.length - 1];
}

describe("CouponDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCustomerContact).mockResolvedValue({
      customer_id: 2011,
      user_email: "",
      billing_email: "",
    });
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
        restrictEmail="guest@example.test"
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
    fireEvent.click(submitButton(view));

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
        free_shipping: false,
        email_restrictions: "guest@example.test",
      }),
      expect.any(String),
    );
  });

  it("includes the free shipping checkbox in the create payload", async () => {
    vi.mocked(createCoupon).mockResolvedValue({
      id: 8,
      code: "SHIP10",
      discount_type: "percent",
      amount: 10,
      usage_limit: 1,
      expires_at: "2099-10-04T00:00:00.000Z",
      customer_restricted: false,
      delivery_message: "Use coupon code SHIP10 at checkout for 10% off and free shipping.",
      chat_delivery: { status: "delivered" },
    });

    const view = render(<CouponDialog conversationId="conversation-1" />);
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    fireEvent.change(view.getByRole("textbox", { name: /Unique coupon code/ }), {
      target: { value: "ship10" },
    });
    fireEvent.change(view.getByRole("spinbutton", { name: /Percentage/ }), {
      target: { value: "10" },
    });
    fireEvent.change(view.getByLabelText(/Expires at/), {
      target: { value: "2099-10-04T00:00" },
    });
    fireEvent.click(view.getByRole("checkbox", { name: "Free shipping" }));
    fireEvent.click(submitButton(view));

    expect(await view.findByText("Coupon SHIP10 created.")).toBeInTheDocument();
    expect(createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SHIP10",
        free_shipping: true,
      }),
      expect.any(String),
    );
  });

  it("allows a free-shipping-only coupon without an amount", async () => {
    vi.mocked(createCoupon).mockResolvedValue({
      id: 9,
      code: "FREESHIP",
      discount_type: "percent",
      amount: 0,
      usage_limit: 1,
      expires_at: "2099-10-04T00:00:00.000Z",
      customer_restricted: false,
      delivery_message: "Use coupon code FREESHIP at checkout for free shipping - it expires by 2099-10-04T00:00:00Z",
      chat_delivery: { status: "delivered" },
    });

    const view = render(<CouponDialog conversationId="conversation-1" />);
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    fireEvent.change(view.getByRole("textbox", { name: /Unique coupon code/ }), {
      target: { value: "freeship" },
    });
    fireEvent.change(view.getByLabelText(/Expires at/), {
      target: { value: "2099-10-04T00:00" },
    });
    expect(submitButton(view)).toBeDisabled();
    fireEvent.click(view.getByRole("checkbox", { name: "Free shipping" }));
    expect(submitButton(view)).toBeEnabled();
    fireEvent.click(submitButton(view));

    expect(await view.findByText("Coupon FREESHIP created.")).toBeInTheDocument();
    expect(view.getByText(/for free shipping/)).toBeInTheDocument();
    expect(view.queryByText(/0% off/)).not.toBeInTheDocument();
    expect(view.queryByText(/AUD 0 off/)).not.toBeInTheDocument();
    expect(createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FREESHIP",
        discount_type: "percent",
        free_shipping: true,
      }),
      expect.any(String),
    );
    const [payload] = vi.mocked(createCoupon).mock.calls[0];
    expect(payload).not.toHaveProperty("amount");
  });

  it("rejects an invalid restriction email before create", () => {
    const view = render(<CouponDialog conversationId="conversation-1" />);
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
    fireEvent.change(view.getByLabelText(/Restrict to email/), {
      target: { value: "not-an-email" },
    });
    expect(submitButton(view)).toBeDisabled();
    expect(createCoupon).not.toHaveBeenCalled();
  });

  it("prefills the email restriction from the conversation email", () => {
    const view = render(
      <CouponDialog
        conversationId="conversation-1"
        restrictEmail="guest@example.test"
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    expect(view.getByLabelText(/Restrict to email/)).toHaveValue("guest@example.test");
  });

  it("prefills customer 2011 from Woo user email contact", async () => {
    vi.mocked(getCustomerContact).mockResolvedValue({
      customer_id: 2011,
      user_email: "ms.j.graybill@gmail.com",
      billing_email: "",
    });
    const view = render(
      <CouponDialog
        customerId={2011}
        conversationId="conversation-2011"
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    await waitFor(() => {
      expect(view.getByLabelText(/Restrict to email/)).toHaveValue("ms.j.graybill@gmail.com");
    });
    expect(getCustomerContact).toHaveBeenCalledWith(2011);
  });

  it("enables Create for free shipping with blank amount and blank email", () => {
    const view = render(<CouponDialog conversationId="conversation-1" />);
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    fireEvent.change(view.getByRole("textbox", { name: /Unique coupon code/ }), {
      target: { value: "freeship" },
    });
    fireEvent.click(view.getByRole("checkbox", { name: "Free shipping" }));
    expect(view.getByLabelText(/Restrict to email/)).toHaveValue("");
    expect(submitButton(view)).toBeEnabled();
  });

  it("disables Create when code or expiry is missing or email is invalid", () => {
    const view = render(<CouponDialog conversationId="conversation-1" />);
    fireEvent.click(view.getByRole("button", { name: "Create coupon" }));
    fireEvent.click(view.getByRole("checkbox", { name: "Free shipping" }));
    expect(submitButton(view)).toBeDisabled();
    fireEvent.change(view.getByRole("textbox", { name: /Unique coupon code/ }), {
      target: { value: "freeship" },
    });
    expect(submitButton(view)).toBeEnabled();
    fireEvent.change(view.getByLabelText(/Expires at/), {
      target: { value: "" },
    });
    expect(submitButton(view)).toBeDisabled();
    fireEvent.change(view.getByLabelText(/Expires at/), {
      target: { value: "2099-10-04T00:00" },
    });
    fireEvent.change(view.getByLabelText(/Restrict to email/), {
      target: { value: "not-an-email" },
    });
    expect(submitButton(view)).toBeDisabled();
    fireEvent.change(view.getByLabelText(/Restrict to email/), {
      target: { value: "ms.j.graybill@gmail.com" },
    });
    expect(submitButton(view)).toBeEnabled();
  });
});
