import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReturn,
  createShippitReturnOrder,
  generateShippitReturnLabel,
  getReturnableOrderItems,
  getShippitReturnOrder,
  listReturns,
} from "../api/returnsApi";
import ReturnsPage from "./ReturnsPage";

vi.mock("../api/returnsApi", () => ({
  createReturn: vi.fn(),
  createShippitReturnOrder: vi.fn(),
  generateShippitReturnLabel: vi.fn(),
  getReturnableOrderItems: vi.fn(),
  getShippitReturnOrder: vi.fn(),
  listReturns: vi.fn(),
  previewShippitReturnQuote: vi.fn(),
  probeShippitReturnsEndpoints: vi.fn(),
  updateReturn: vi.fn(),
}));

const returnRecord = {
  order_id: 134400,
  return_id: 7,
  return: {
    return_order_id: "RETURN-TRACKING",
    tracking_number: "RETURN-TRACKING",
    state: "return_requested",
    label_url: "",
  },
};

describe("ReturnsPage Shippit workflow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires a saved case and explicit confirmation before label generation", async () => {
    vi.mocked(listReturns).mockResolvedValue([]);
    vi.mocked(getReturnableOrderItems).mockResolvedValue({
      order: {
        id: 134400,
        number: "134400",
        status: "delivered",
        date_created: null,
        customer: { email: "customer@example.test", first_name: "Test", last_name: "Customer" },
        shipping_address: {},
      },
      items: [{
        order_item_id: 11,
        product_id: 21,
        variation_id: 0,
        sku: "SKU-1",
        product_name: "Test Product",
        ordered_qty: 1,
        refunded_qty: 0,
        existing_return_qty: 0,
        returnable_qty: 1,
        unit_price: 10,
        weight_g: 500,
        length_cm: 10,
        width_cm: 10,
        height_cm: 10,
      }],
    });
    vi.mocked(createReturn).mockResolvedValue({
      id: 7,
      order_id: 134400,
      status: "requested",
      reason: "",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      created_at: "2026-09-18",
      updated_at: "2026-09-18",
      lines: [{ order_item_id: 11, qty: 1 }],
    });
    vi.mocked(createShippitReturnOrder).mockResolvedValue(returnRecord);
    vi.mocked(getShippitReturnOrder).mockResolvedValue(returnRecord);
    vi.mocked(generateShippitReturnLabel).mockResolvedValue({
      ...returnRecord,
      return: { ...returnRecord.return, label_url: "https://labels.example.test/return.pdf" },
    });

    const view = render(<ReturnsPage />);
    fireEvent.change(view.getByLabelText("WooCommerce Order ID"), { target: { value: "134400" } });
    fireEvent.click(view.getByRole("button", { name: "Load Returnable Items" }));
    await waitFor(() => expect(view.getByText("Test Product")).toBeInTheDocument());

    fireEvent.change(view.getAllByRole("spinbutton")[1], { target: { value: "1" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Return Case #7 Saved" })).toBeDisabled());

    fireEvent.click(view.getByRole("button", { name: "Create Shippit Return" }));
    await waitFor(() => expect(createShippitReturnOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 134400,
      returnId: 7,
      operationId: expect.any(String),
    })));

    fireEvent.click(view.getByRole("button", { name: "Refresh Status" }));
    await waitFor(() => expect(getShippitReturnOrder).toHaveBeenCalledOnce());
    expect(generateShippitReturnLabel).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Approve Return and Generate Label" }));
    expect(view.getByText(/This action approves the return in Shippit/)).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Approve and Generate Label" }));
    await waitFor(() => expect(generateShippitReturnLabel).toHaveBeenCalledWith(134400, "RETURN-TRACKING"));
  });
});
