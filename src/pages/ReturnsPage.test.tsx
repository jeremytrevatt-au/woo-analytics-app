import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReturn,
  createShippitReturnOrder,
  fetchShippitReturnLabel,
  getReturnableOrderItems,
  getShippitReturnOrder,
  listReturns,
  previewShippitReturnQuote,
} from "../api/returnsApi";
import ReturnsPage from "./ReturnsPage";

vi.mock("../api/returnsApi", () => ({
  createReturn: vi.fn(),
  createShippitReturnOrder: vi.fn(),
  fetchShippitReturnLabel: vi.fn(),
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

  it("confirms live booking and retrieves the existing label separately", async () => {
    vi.mocked(listReturns).mockResolvedValue([]);
    vi.mocked(getReturnableOrderItems).mockResolvedValue({
      order: {
        id: 134400,
        number: "134400",
        status: "delivered",
        currency: "AUD",
        date_created: null,
        customer: { email: "customer@example.test", first_name: "Test", last_name: "Customer" },
        shipping_address: {
          first_name: "Test",
          last_name: "Customer",
          company: "",
          address_1: "1 Original Street",
          address_2: "",
          suburb: "Sydney",
          state: "NSW",
          postcode: "2000",
          country: "AU",
          phone: "0400000000",
        },
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
      return_sender: {
        name: "Samantha Actual Recipient",
        address_line_1: "10 Correct Street",
        suburb: "Googong",
        state: "NSW",
        postcode: "2620",
        country_code: "AU",
        email: "customer@example.test",
        phone: "0400000000",
      },
      created_at: "2026-09-18",
      updated_at: "2026-09-18",
      lines: [{ order_item_id: 11, qty: 1 }],
    });
    vi.mocked(createShippitReturnOrder).mockResolvedValue(returnRecord);
    vi.mocked(previewShippitReturnQuote).mockResolvedValue({
      name: "returns_quote_preview_v3",
      method: "POST",
      url: "https://app.staging.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 100,
      body: {
        response: [{
          success: true,
          courier_type: "standard",
          service_level: "Standard",
          quotes: [{ price: 12.34, estimated_transit_time: "2 days" }],
        }],
      },
    });
    vi.mocked(getShippitReturnOrder).mockResolvedValue(returnRecord);
    vi.mocked(fetchShippitReturnLabel).mockResolvedValue({
      ...returnRecord,
      return: { ...returnRecord.return, label_url: "https://labels.example.test/return.pdf" },
    });

    const view = render(<ReturnsPage />);
    fireEvent.change(view.getByLabelText("WooCommerce Order ID"), { target: { value: "134400" } });
    fireEvent.click(view.getByRole("button", { name: "Load Returnable Items" }));
    await waitFor(() => expect(view.getByText("Test Product")).toBeInTheDocument());

    fireEvent.change(view.getAllByRole("spinbutton")[1], { target: { value: "1" } });
    fireEvent.click(view.getByLabelText("Use a different return sender address"));
    fireEvent.change(await view.findByLabelText(/Return Sender Name/), { target: { value: "Samantha Actual Recipient" } });
    fireEvent.change(view.getByLabelText(/Address Line 1/), { target: { value: "10 Correct Street" } });
    fireEvent.change(view.getByLabelText(/Suburb/), { target: { value: "Googong" } });
    fireEvent.change(view.getByLabelText(/Postcode/), { target: { value: "2620" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Return Case #7 Saved" })).toBeDisabled());
    expect(createReturn).toHaveBeenCalledWith(expect.objectContaining({
      return_sender: expect.objectContaining({
        name: "Samantha Actual Recipient",
        address_line_1: "10 Correct Street",
        suburb: "Googong",
        postcode: "2620",
      }),
    }));
    fireEvent.click(view.getByRole("button", { name: "Quote Saved Return Case" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Select" })).toBeInTheDocument());
    expect(previewShippitReturnQuote).toHaveBeenCalledWith({ orderId: 134400, returnId: 7 });
    fireEvent.click(view.getByRole("button", { name: "Select" }));

    fireEvent.click(view.getByRole("button", { name: "Create and Book Shippit Return" }));
    expect(view.getByText(/This creates a live Shippit return shipment/)).toBeInTheDocument();
    expect(view.getByText(/Return sender: Samantha Actual Recipient.*10 Correct Street.*Googong NSW 2620/)).toBeInTheDocument();
    expect(createShippitReturnOrder).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Create and Book Return" }));
    await waitFor(() => expect(createShippitReturnOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 134400,
      returnId: 7,
      operationId: expect.any(String),
      courierType: "standard",
      quotedCost: 12.34,
      currency: "AUD",
    })));

    const refreshButton = await view.findByRole("button", { name: "Refresh Status" });
    fireEvent.click(refreshButton);
    await waitFor(() => expect(getShippitReturnOrder).toHaveBeenCalledOnce());
    expect(fetchShippitReturnLabel).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Fetch Return Label" }));
    await waitFor(() => expect(fetchShippitReturnLabel).toHaveBeenCalledWith(134400, "RETURN-TRACKING"));
  }, 15000);

  it("shows outbound and return shipment details separately", async () => {
    vi.mocked(listReturns).mockResolvedValue([{
      id: 4,
      order_id: 134336,
      status: "approved",
      reason: "Changed mind",
      resolution: "Return label",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      created_at: "2026-09-18",
      updated_at: "2026-09-18",
      lines: [{ id: 1, order_item_id: 11, product_name: "Test Product", sku: "SKU-1", qty: 1 }],
      originating_order: {
        id: 134336,
        number: "134336",
        status: "delivered",
        status_label: "Delivered",
        fulfillment_status: "Fulfilled",
        currency: "AUD",
      },
      outbound_shipment: {
        tracking_number: "OUTBOUND-TRACKING",
        tracking_url: "https://tracking.example.test/outbound",
        state: "completed",
        courier_name: "Aramex",
      },
      return_shipment: {
        return_order_id: "RETURN-TRACKING",
        tracking_number: "RETURN-TRACKING",
        tracking_url: "https://tracking.example.test/return",
        state: "return_requested",
        courier_name: "Aramex",
        quoted_cost: 12.34,
        currency: "AUD",
        parcels: [{ length: 0.325, width: 0.205, depth: 0.03, weight: 0.5, package_type: "satchel" }],
      },
    }]);

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#4")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "View" }));

    expect(view.getByText("Order status: Delivered")).toBeInTheDocument();
    expect(view.getByText("Outbound fulfillment: Fulfilled")).toBeInTheDocument();
    expect(view.getByText("OUTBOUND-TRACKING")).toBeInTheDocument();
    expect(view.getByText("RETURN-TRACKING")).toBeInTheDocument();
    expect(view.getByText("Quoted cost: AUD 12.34")).toBeInTheDocument();
    expect(view.getByText(/0.325 × 0.205 × 0.03 m, 0.5 kg, satchel/)).toBeInTheDocument();
  });
});
