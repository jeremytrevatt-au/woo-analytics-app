import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptShippitReturnQuote,
  bookShippitReturnPickup,
  cancelReturn,
  confirmShippitReturnOrder,
  createReturn,
  createShippitReturnOrder,
  fetchShippitReturnLabel,
  getReturnableOrderItems,
  getShipmentMode,
  getShippitReturnOrder,
  listReturns,
  previewReturnCancellation,
  previewReturnParcels,
  previewShippitReturnQuote,
  setShipmentMode,
} from "../api/returnsApi";
import ReturnsPage from "./ReturnsPage";

vi.mock("../api/returnsApi", () => ({
  acceptShippitReturnQuote: vi.fn(),
  bookShippitReturnPickup: vi.fn(),
  cancelReturn: vi.fn(),
  confirmShippitReturnOrder: vi.fn(),
  createReturn: vi.fn(),
  createShippitReturnOrder: vi.fn(),
  fetchShippitReturnLabel: vi.fn(),
  getReturnableOrderItems: vi.fn(),
  getShipmentMode: vi.fn(),
  getShippitReturnOrder: vi.fn(),
  listReturns: vi.fn(),
  previewReturnCancellation: vi.fn(),
  previewReturnParcels: vi.fn(),
  previewShippitReturnQuote: vi.fn(),
  setShipmentMode: vi.fn(),
  probeShippitReturnsEndpoints: vi.fn(),
  updateReturn: vi.fn(),
}));

const returnRecord = {
  order_id: 134400,
  return_id: 7,
  workflow_stage: "new_order" as const,
  return: {
    return_order_id: "RETURN-TRACKING",
    tracking_number: "RETURN-TRACKING",
    state: "order_placed",
    label_url: "",
  },
};

describe("ReturnsPage Shippit workflow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("quotes and accepts a Returns API shipment, then requests the label without booking", async () => {
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
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      mode: "",
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    });
    vi.mocked(setShipmentMode).mockImplementation(async payload => ({
      order_id: payload.orderId,
      return_id: payload.returnId,
      mode: payload.mode,
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    }));
    vi.mocked(acceptShippitReturnQuote).mockResolvedValue({
      ...returnRecord,
      mode: "returns_api",
      label_ready: false,
    });
    vi.mocked(confirmShippitReturnOrder).mockResolvedValue({
      ...returnRecord,
      mode: "returns_api",
      workflow_stage: "label_requested",
      label_ready: true,
      shippit_state: "despatch_in_progress",
      return: { ...returnRecord.return, state: "despatch_in_progress" },
    });
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      parcels: [{ qty: 1, weight_kg: 0.53, length_cm: 12, width_cm: 11, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });
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
    const parcelWeight = await view.findByDisplayValue("0.53");
    fireEvent.change(parcelWeight, { target: { value: "0.6" } });
    expect(view.getByText(/Source: manual adjustment/)).toBeInTheDocument();
    expect(createReturn).toHaveBeenCalledWith(expect.objectContaining({
      return_sender: expect.objectContaining({
        name: "Samantha Actual Recipient",
        address_line_1: "10 Correct Street",
        suburb: "Googong",
        postcode: "2620",
      }),
    }));
    await waitFor(() => expect(view.getByRole("radio", { name: "Standard pickup" })).toBeChecked());
    expect(view.getByRole("button", { name: "Get a quote — prices only" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("radio", { name: "Returns API" }));
    await waitFor(() => expect(view.getByRole("radio", { name: "Returns API" })).toBeChecked());
    const quoteButton = await view.findByRole("button", { name: "Get a quote — prices only" });
    const acceptButton = view.getByRole("button", { name: "Accept quote — create Shippit order in New Orders" });
    const labelButton = view.getByRole("button", { name: "Request label — this allocates the courier" });
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    expect(view.getByText("Status: not quoted")).toBeInTheDocument();
    expect(acceptButton).toBeDisabled();
    expect(labelButton).toBeDisabled();
    expect(view.queryByRole("button", { name: "Print label" })).not.toBeInTheDocument();

    fireEvent.click(quoteButton);
    await waitFor(() => expect(view.getByRole("button", { name: "Select" })).toBeInTheDocument());
    expect(view.getByText("Status: quoted")).toBeInTheDocument();
    expect(previewShippitReturnQuote).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      parcels: [{ qty: 1, weight_kg: 0.6, length_cm: 12, width_cm: 11, height_cm: 10 }],
      parcelSource: "manual",
      mode: "returns_api",
    });
    expect(acceptButton).toBeDisabled();
    fireEvent.click(view.getByRole("button", { name: "Select" }));
    expect(view.getByText("Selected price: $12.34 standard")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Accept quote — create Shippit order in New Orders" })).toBeEnabled();
    expect(view.getByRole("button", { name: "Request label — this allocates the courier" })).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Accept quote — create Shippit order in New Orders" }));
    await waitFor(() => expect(acceptShippitReturnQuote).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 134400,
      returnId: 7,
      operationId: expect.any(String),
      courierType: "standard",
      quotedCost: 12.34,
      currency: "AUD",
      mode: "returns_api",
    })));
    expect(view.getByText("Status: new order")).toBeInTheDocument();
    expect(confirmShippitReturnOrder).not.toHaveBeenCalled();
    expect(bookShippitReturnPickup).not.toHaveBeenCalled();
    expect(view.queryByRole("button", { name: "Print label" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => expect(getShippitReturnOrder).toHaveBeenCalledOnce());
    expect(fetchShippitReturnLabel).not.toHaveBeenCalled();
    expect(bookShippitReturnPickup).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Request label — this allocates the courier" }));
    await waitFor(() => expect(confirmShippitReturnOrder).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      mode: "returns_api",
    }));
    expect(view.getByText("Status: label requested")).toBeInTheDocument();
    expect(bookShippitReturnPickup).not.toHaveBeenCalled();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Print label" }));
    await waitFor(() => expect(fetchShippitReturnLabel).toHaveBeenCalledWith(134400, "RETURN-TRACKING"));
  }, 15000);

  it("creates a standard pickup, prints the label, and books only after that label exists", async () => {
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
      created_at: "2026-09-18",
      updated_at: "2026-09-18",
      lines: [{ order_item_id: 11, qty: 1 }],
    });
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      mode: "",
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    });
    vi.mocked(setShipmentMode).mockImplementation(async payload => ({
      order_id: payload.orderId,
      return_id: payload.returnId,
      mode: payload.mode,
      mode_locked: true,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    }));
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      parcels: [{ qty: 1, weight_kg: 0.53, length_cm: 12, width_cm: 11, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });
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
          quotes: [{ price: 18.4, estimated_transit_time: "2 days" }],
        }],
      },
    });
    vi.mocked(createShippitReturnOrder).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      mode: "standard",
      workflow_stage: "new_order",
      label_ready: false,
      shippit_state: "order_placed",
      return: {
        return_order_id: "STANDARD-TRACKING",
        tracking_number: "STANDARD-TRACKING",
        state: "order_placed",
        label_url: "",
        quoted_cost: 0,
      },
    });
    vi.mocked(confirmShippitReturnOrder).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      mode: "standard",
      workflow_stage: "new_order",
      label_ready: true,
      shippit_state: "order_placed",
      return: {
        return_order_id: "STANDARD-TRACKING",
        tracking_number: "STANDARD-TRACKING",
        state: "order_placed",
        label_url: "",
        quoted_cost: 0,
      },
    });
    vi.mocked(bookShippitReturnPickup).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      mode: "standard",
      workflow_stage: "booked",
      label_ready: true,
      shippit_state: "ready_for_pickup",
      return: {
        return_order_id: "STANDARD-TRACKING",
        tracking_number: "STANDARD-TRACKING",
        state: "ready_for_pickup",
        label_url: "",
      },
    });

    const view = render(<ReturnsPage />);
    fireEvent.change(view.getByLabelText("WooCommerce Order ID"), { target: { value: "134400" } });
    fireEvent.click(view.getByRole("button", { name: "Load Returnable Items" }));
    await waitFor(() => expect(view.getByText("Test Product")).toBeInTheDocument());
    fireEvent.change(view.getAllByRole("spinbutton")[1], { target: { value: "1" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Return Case #7 Saved" })).toBeDisabled());
    await view.findByDisplayValue("0.53");
    await waitFor(() => expect(view.getByRole("radio", { name: "Standard pickup" })).toBeChecked());

    expect(view.queryByText("Shippit cannot quote a customer pickup. The price appears on the order.")).not.toBeInTheDocument();
    const quoteButton = view.getByRole("button", { name: "Get a quote — prices only" });
    const createButton = view.getByRole("button", { name: "Create Shippit order — New Orders" });
    const printStep = view.getByRole("button", { name: "Print label — move to Ready to Ship" });
    const bookButton = view.getByRole("button", { name: "Book pickup — book the courier once the sender is ready" });
    expect(createButton).toBeDisabled();
    expect(printStep).toBeDisabled();
    expect(bookButton).toBeDisabled();
    expect(view.queryByRole("button", { name: "Accept quote — create Shippit order in New Orders" })).not.toBeInTheDocument();

    fireEvent.click(quoteButton);
    await waitFor(() => expect(view.getByRole("button", { name: "Select" })).toBeInTheDocument());
    expect(previewShippitReturnQuote).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      parcels: [{ qty: 1, weight_kg: 0.53, length_cm: 12, width_cm: 11, height_cm: 10 }],
      parcelSource: "ny_recommendation",
      mode: "standard",
    });
    expect(view.getByText("These prices are return-courier quotes. The order created afterwards is a standard pickup, so the booked carrier can differ.")).toBeInTheDocument();
    expect(createButton).toBeDisabled();
    fireEvent.click(view.getByRole("button", { name: "Select" }));
    expect(view.getByText("Selected price: $18.40 standard")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Create Shippit order — New Orders" })).toBeEnabled();
    expect(printStep).toBeDisabled();
    expect(bookButton).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Create Shippit order — New Orders" }));
    await waitFor(() => expect(createShippitReturnOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 134400,
      returnId: 7,
      courierType: "standard",
      mode: "standard",
      parcelSource: "ny_recommendation",
      parcels: [{ qty: 1, weight_kg: 0.53, length_cm: 12, width_cm: 11, height_cm: 10 }],
    })));
    expect(previewShippitReturnQuote).toHaveBeenCalledOnce();
    expect(acceptShippitReturnQuote).not.toHaveBeenCalled();
    expect(view.getByText("Status: new order")).toBeInTheDocument();
    expect(bookButton).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Print label — move to Ready to Ship" }));
    await waitFor(() => expect(confirmShippitReturnOrder).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      mode: "standard",
    }));
    expect(view.getByText("Status: new order")).toBeInTheDocument();
    expect(bookShippitReturnPickup).not.toHaveBeenCalled();
    expect(view.getByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).toBeEnabled();
    expect(view.getByRole("button", { name: "Print label" })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Book pickup — book the courier once the sender is ready" }));
    await waitFor(() => expect(bookShippitReturnPickup).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      mode: "standard",
    }));
    expect(view.getByText("Status: booked")).toBeInTheDocument();
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

  it("confirms carrier cancellation and leaves stock unchanged without a recorded deduction", async () => {
    vi.mocked(listReturns).mockResolvedValue([{
      id: 7,
      order_id: 134400,
      status: "approved",
      reason: "Changed mind",
      resolution: "Return label",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      shippit_tracking_number: "RETURN-TRACKING",
      shippit_state: "order_placed",
      cancellation_state: "not_cancelled",
      created_at: "2026-09-18",
      updated_at: "2026-09-18",
      lines: [{ id: 1, order_item_id: 11, product_id: 21, product_name: "Test Product", qty: 1 }],
    }]);
    vi.mocked(previewReturnCancellation).mockResolvedValue({
      order_id: 134400,
      return_id: 7,
      case_status: "approved",
      cancellation_state: "not_cancelled",
      shippit_tracking_number: "RETURN-TRACKING",
      shippit_state: "order_placed",
      cancellable: true,
      reason: "",
      inventory_reversals: [],
      inventory_quantity_restore: 0,
    });
    vi.mocked(cancelReturn)
      .mockRejectedValueOnce(new Error("Temporary cancellation error"))
      .mockResolvedValue({
        order_id: 134400,
        return_id: 7,
        status: "cancelled",
        operation_id: "00000000-0000-4000-8000-000000000001",
        cancellation_state: "completed",
        cancelled_at: "2026-09-19",
        shippit_state: "cancelled",
        idempotent_replay: false,
        inventory_reversals: [],
      });

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#7")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "View" }));
    fireEvent.click(view.getByRole("button", { name: "Cancel Return" }));

    await waitFor(() => expect(view.getByText(/No inventory deduction is recorded/)).toBeInTheDocument());
    expect(previewReturnCancellation).toHaveBeenCalledWith(expect.objectContaining({ id: 7, order_id: 134400 }));
    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Cancel Return" }));

    await waitFor(() => expect(view.getByText("Temporary cancellation error")).toBeInTheDocument());
    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Cancel Return" }));
    await waitFor(() => expect(cancelReturn).toHaveBeenLastCalledWith(expect.objectContaining({
      returnId: 7,
      orderId: 134400,
      operationId: expect.any(String),
    })));
    expect(vi.mocked(cancelReturn).mock.calls[0][0].operationId)
      .toBe(vi.mocked(cancelReturn).mock.calls[1][0].operationId);
    await waitFor(() => expect(view.getByText(/No recorded inventory deduction required reversal/)).toBeInTheDocument());
  });
});
