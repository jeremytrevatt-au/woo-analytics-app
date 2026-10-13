import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdditionalShippingCost from "./AdditionalShippingCost";
import { createAdditionalShipping, previewAdditionalShipping, sendAdditionalShippingEmail } from "../api/additionalShippingApi";

vi.mock("../api/additionalShippingApi", () => ({
  previewAdditionalShipping: vi.fn(),
  createAdditionalShipping: vi.fn(),
  sendAdditionalShippingEmail: vi.fn(),
}));

const quote = { courier_type: "couriers_please", service_level: "Standard", price: 20 };

describe("AdditionalShippingCost", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides the email action when the difference is not positive", async () => {
    vi.mocked(previewAdditionalShipping).mockResolvedValue({
      order_id: 501,
      paid_shipping: 12.34,
      new_shipping: 12.34,
      difference: 0,
      paid_shipping_display: "$12.34",
      new_shipping_display: "$12.34",
      difference_display: "$0.00",
      show_action: false,
      billing_email: "buyer@example.test",
      payment_state: "none",
    });

    const view = render(<AdditionalShippingCost orderId={501} quote={quote} />);

    await waitFor(() => expect(previewAdditionalShipping).toHaveBeenCalled());
    expect(view.queryByRole("button", { name: "Send Extra Shipping Cost Email to Customer" })).not.toBeInTheDocument();
    expect(view.queryByText(/Paid shipping/)).not.toBeInTheDocument();
  });

  it("shows paid, new, and difference with cents and sends only after confirmation", async () => {
    vi.mocked(previewAdditionalShipping).mockResolvedValue({
      order_id: 501,
      paid_shipping: 12.34,
      new_shipping: 20,
      difference: 7.66,
      paid_shipping_display: "$12.34",
      new_shipping_display: "$20.00",
      difference_display: "$7.66",
      show_action: true,
      billing_email: "buyer@example.test",
      payment_state: "none",
    });
    vi.mocked(createAdditionalShipping).mockResolvedValue({
      order_id: 501,
      additional_order_id: 900,
      difference: 7.66,
      difference_display: "$7.66",
      reused: false,
      payment_state: "unpaid",
    });
    vi.mocked(sendAdditionalShippingEmail).mockResolvedValue({
      order_id: 501,
      additional_order_id: 900,
      difference: 7.66,
      template_id: 5,
      sent: true,
    });

    const view = render(<AdditionalShippingCost orderId={501} quote={quote} />);

    expect(await view.findByText("Paid shipping: $12.34")).toBeInTheDocument();
    expect(view.getByText("New shipping: $20.00")).toBeInTheDocument();
    expect(view.getByText("Difference: $7.66")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Send Extra Shipping Cost Email to Customer" }));
    const recipient = view.getByLabelText("Recipient") as HTMLInputElement;
    expect(recipient.value).toBe("buyer@example.test");
    expect(recipient).toBeDisabled();
    expect(sendAdditionalShippingEmail).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendAdditionalShippingEmail).toHaveBeenCalledWith(501, true));
    expect(createAdditionalShipping).toHaveBeenCalledWith(501, quote);
  });

  it("stays hidden for a reserve order", async () => {
    const view = render(<AdditionalShippingCost orderId={501} quote={quote} hidden />);
    expect(view.queryByRole("button", { name: "Send Extra Shipping Cost Email to Customer" })).not.toBeInTheDocument();
    expect(previewAdditionalShipping).not.toHaveBeenCalled();
  });
});
