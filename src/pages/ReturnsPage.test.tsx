import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptShippitReturnQuote,
  cancelReturn,
  confirmShippitReturnOrder,
  createReturn,
  fetchReturnDocument,
  fetchShippitReturnLabel,
  getReturnableOrderItems,
  getShipmentMode,
  getShippitReturnOrder,
  listReturns,
  updateReturn,
  previewReturnCancellation,
  previewReturnParcels,
  previewShippitReturnQuote,
  sendReturnDocumentEmail,
} from "../api/returnsApi";
import ReturnsPage from "./ReturnsPage";

vi.mock("../api/returnsApi", () => ({
  acceptShippitReturnQuote: vi.fn(),
  cancelReturn: vi.fn(),
  confirmShippitReturnOrder: vi.fn(),
  createReturn: vi.fn(),
  fetchReturnDocument: vi.fn(),
  fetchShippitReturnLabel: vi.fn(),
  getReturnableOrderItems: vi.fn(),
  getShipmentMode: vi.fn(),
  getShippitReturnOrder: vi.fn(),
  listReturns: vi.fn(),
  previewReturnCancellation: vi.fn(),
  previewReturnParcels: vi.fn(),
  previewShippitReturnQuote: vi.fn(),
  probeShippitReturnsEndpoints: vi.fn(),
  sendReturnDocumentEmail: vi.fn(),
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
    await waitFor(() => expect(view.getByRole("heading", { name: "Return Case #7" })).toBeInTheDocument());
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
    expect(view.queryByRole("radio", { name: "Standard pickup" })).not.toBeInTheDocument();
    expect(view.queryByRole("radio", { name: "Returns API" })).not.toBeInTheDocument();
    expect(view.queryByText("Shipment mode")).not.toBeInTheDocument();
    const quoteButton = await view.findByRole("button", { name: "Get a quote — prices only" });
    const acceptButton = view.getByRole("button", { name: "Accept quote — create the Shippit order in New Orders" });
    const labelButton = view.getByRole("button", { name: "Request label — this confirms the return and allocates the courier" });
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    expect(view.getByText("Status: not quoted")).toBeInTheDocument();
    expect(acceptButton).toBeDisabled();
    expect(labelButton).toBeDisabled();
    expect(view.getByRole("button", { name: "Print label" })).toBeDisabled();
    expect(view.getByRole("button", { name: "Request label again" })).toBeDisabled();
    expect(view.getByText("Current. 1. Get a quote — prices only")).toBeInTheDocument();
    expect(view.getByText("No Shippit order yet.")).toBeInTheDocument();
    expect(view.getByText("The courier is not allocated. Leave the return here until you are ready to send the label to the customer.")).toBeInTheDocument();
    expect(view.getByText("There is no Book step. Australia Post then shows as Awaiting drop off. A courier collection shows as Return requested.")).toBeInTheDocument();
    expect(view.getByText(/The link lasts 7 days/)).toBeInTheDocument();
    expect(view.getByText(/Shippit's automatic email goes to the shop address, not the customer/)).toBeInTheDocument();
    expect(view.getByText(/Australia Post: the customer attaches the label/)).toBeInTheDocument();
    expect(view.getByText(/Aramex, Couriers Please, or Allied Express/)).toBeInTheDocument();
    expect(view.getByText("No Shippit portal step is required after these buttons succeed.")).toBeInTheDocument();

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
    expect(view.getByRole("button", { name: "Accept quote — create the Shippit order in New Orders" })).toBeEnabled();
    expect(view.getByRole("button", { name: "Request label — this confirms the return and allocates the courier" })).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "Accept quote — create the Shippit order in New Orders" }));
    await waitFor(() => expect(acceptShippitReturnQuote).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 134400,
      returnId: 7,
      operationId: expect.any(String),
      courierType: "standard",
      quotedCost: 12.34,
      currency: "AUD",
      mode: "returns_api",
    })));
    expect(view.getByText("Status: order_placed")).toBeInTheDocument();
    expect(confirmShippitReturnOrder).not.toHaveBeenCalled();
    expect(view.getByRole("button", { name: "Print label" })).toBeDisabled();
    expect(view.getByText("Current. 3. Request label — this confirms the return and allocates the courier")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => expect(getShippitReturnOrder).toHaveBeenCalledOnce());
    expect(fetchShippitReturnLabel).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Request label — this confirms the return and allocates the courier" }));
    await waitFor(() => expect(confirmShippitReturnOrder).toHaveBeenCalledWith({
      orderId: 134400,
      returnId: 7,
      mode: "returns_api",
    }));
    expect(view.getByText("Status: despatch_in_progress")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    expect(view.queryByText(/courier is not booked/i)).not.toBeInTheDocument();
    expect(view.queryByText(/unbooked/i)).not.toBeInTheDocument();
    expect(view.getByText("Current. 4. Print label")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Request label again" })).toBeDisabled();
    fireEvent.click(view.getByRole("button", { name: "Print label" }));
    await waitFor(() => expect(fetchShippitReturnLabel).toHaveBeenCalledWith(134400, "RETURN-TRACKING"));
    await waitFor(() => expect(view.getByRole("link", { name: "Print label" })).toHaveAttribute("href", "https://labels.example.test/return.pdf"));
    expect(view.getByText("Current. 5. Customer instructions")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Request label again" }));
    await waitFor(() => expect(fetchShippitReturnLabel).toHaveBeenCalledTimes(2));
    expect(confirmShippitReturnOrder).toHaveBeenCalledTimes(1);
    expect(view.getByRole("button", { name: "Generate customer email" })).toBeEnabled();
    expect(view.getByRole("button", { name: "Generate insert letter" })).toBeEnabled();
    expect(sendReturnDocumentEmail).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Send customer email" }));
    expect(sendReturnDocumentEmail).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Send the email" }));
    await waitFor(() => expect(sendReturnDocumentEmail).toHaveBeenCalledWith(7));
    expect(fetchReturnDocument).not.toHaveBeenCalled();
  }, 15000);

  it("opens a stored standard return with no tracking on the Returns API steps", async () => {
    vi.mocked(listReturns).mockResolvedValue([]);
    vi.mocked(getReturnableOrderItems).mockResolvedValue({
      order: {
        id: 134254,
        number: "134254",
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
      id: 12,
      order_id: 134254,
      status: "requested",
      reason: "",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      shippit_mode: "standard",
      shippit_tracking_number: "",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ order_item_id: 11, qty: 1 }],
    });
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134254,
      return_id: 12,
      mode: "standard",
      mode_locked: true,
      workflow_stage: "quoted",
      shippit_state: "",
      label_ready: false,
      price: null,
    });
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134254,
      return_id: 12,
      parcels: [{ qty: 1, weight_kg: 0.53, length_cm: 12, width_cm: 11, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });

    const view = render(<ReturnsPage />);
    fireEvent.change(view.getByLabelText("WooCommerce Order ID"), { target: { value: "134254" } });
    fireEvent.click(view.getByRole("button", { name: "Load Returnable Items" }));
    await waitFor(() => expect(view.getByText("Test Product")).toBeInTheDocument());
    fireEvent.change(view.getAllByRole("spinbutton")[1], { target: { value: "1" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));
    await waitFor(() => expect(view.getByRole("heading", { name: "Return Case #12" })).toBeInTheDocument());
    await view.findByDisplayValue("0.53");

    expect(view.queryByRole("radio", { name: "Standard pickup" })).not.toBeInTheDocument();
    expect(view.queryByRole("radio", { name: "Returns API" })).not.toBeInTheDocument();
    expect(view.queryByText("Shipment mode")).not.toBeInTheDocument();
    const quoteButton = view.getByRole("button", { name: "Get a quote — prices only" });
    const acceptButton = view.getByRole("button", { name: "Accept quote — create the Shippit order in New Orders" });
    const labelButton = view.getByRole("button", { name: "Request label — this confirms the return and allocates the courier" });
    expect(quoteButton).toBeEnabled();
    expect(acceptButton).toBeDisabled();
    expect(labelButton).toBeDisabled();
    expect(view.queryByRole("button", { name: "Create Shippit order — New Orders" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    expect(acceptShippitReturnQuote).not.toHaveBeenCalled();
    expect(confirmShippitReturnOrder).not.toHaveBeenCalled();
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
    expect(view.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "View" }));

    expect(view.getByText("Order status: Delivered")).toBeInTheDocument();
    expect(view.getByText("Outbound fulfillment: Fulfilled")).toBeInTheDocument();
    expect(view.getByText("OUTBOUND-TRACKING")).toBeInTheDocument();
    expect(view.getByText("RETURN-TRACKING")).toBeInTheDocument();
    expect(view.getByText("Quoted cost: AUD 12.34")).toBeInTheDocument();
    expect(view.getByText(/0.325 × 0.205 × 0.03 m, 0.5 kg, satchel/)).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Get a quote — prices only" })).not.toBeInTheDocument();
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
    expect(view.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
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

  it("opens a Requested case for the same edit, quote, and book actions as a new case", async () => {
    const requestedCase = {
      id: 112,
      order_id: 134254,
      status: "requested" as const,
      reason: "Size",
      resolution: "Replace",
      refund_expected: false,
      refund_reference: "",
      notes: "Keep",
      shippit_tracking_number: "",
      shippit_state: "",
      shippit_create_state: "not_created",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ id: 1, order_item_id: 11, product_id: 21, sku: "SKU-1", product_name: "Test Product", qty: 2 }],
    };
    vi.mocked(listReturns).mockResolvedValue([requestedCase]);
    vi.mocked(getReturnableOrderItems).mockResolvedValue({
      order: {
        id: 134254,
        number: "134254",
        status: "completed",
        currency: "AUD",
        date_created: null,
        customer: { email: "customer@example.test", first_name: "Test", last_name: "Customer" },
        shipping_address: {
          first_name: "Test",
          last_name: "Customer",
          company: "",
          address_1: "1 Example Street",
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
        ordered_qty: 2,
        refunded_qty: 0,
        existing_return_qty: 2,
        returnable_qty: 0,
        unit_price: 10,
        weight_g: 500,
        length_cm: 10,
        width_cm: 10,
        height_cm: 10,
      }],
    });
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134254,
      return_id: 112,
      parcels: [{ qty: 1, weight_kg: 0.5, length_cm: 10, width_cm: 10, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134254,
      return_id: 112,
      mode: "",
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    });
    vi.mocked(updateReturn).mockImplementation(async (_returnId, payload) => ({
      ...requestedCase,
      reason: payload.reason || requestedCase.reason,
      lines: payload.lines || requestedCase.lines,
    }));

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#112")).toBeInTheDocument());
    const requestedRow = view.getByText("#112").closest("tr");
    expect(requestedRow).not.toBeNull();
    expect(within(requestedRow as HTMLElement).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(within(requestedRow as HTMLElement).getByRole("button", { name: "Edit" })).toBeInTheDocument();

    fireEvent.click(within(requestedRow as HTMLElement).getByRole("button", { name: "View" }));
    expect(view.getByText("Return status: requested")).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Return Case #112" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Get a quote — prices only" })).not.toBeInTheDocument();
    expect(getReturnableOrderItems).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Edit" }));

    await waitFor(() => expect(view.getByRole("heading", { name: "Return Case #112" })).toBeInTheDocument());
    expect(view.getByText("Status is Requested. Edit the return lines and case fields, save them, then follow the return shipment steps below.")).toBeInTheDocument();
    expect(view.getByDisplayValue("2")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Get a quote — prices only" })).toBeEnabled();
    expect(view.getByRole("button", { name: "Accept quote — create the Shippit order in New Orders" })).toBeDisabled();
    expect(view.getByRole("button", { name: "Request label — this confirms the return and allocates the courier" })).toBeDisabled();
    expect(view.queryByRole("radio", { name: "Standard pickup" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();

    fireEvent.change(view.getByLabelText("Reason"), { target: { value: "Damaged" } });
    fireEvent.change(view.getByLabelText("Resolution"), { target: { value: "Refund" } });
    fireEvent.change(view.getByLabelText("Return case notes"), { target: { value: "Updated note" } });
    fireEvent.click(view.getByLabelText("Refund may be required"));
    fireEvent.change(view.getByDisplayValue("2"), { target: { value: "1" } });
    fireEvent.click(view.getByLabelText("Use a different return sender address"));
    fireEvent.change(view.getByLabelText(/Return Sender Name/), { target: { value: "Return Sender" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));

    await waitFor(() => expect(updateReturn).toHaveBeenCalledWith(112, expect.objectContaining({
      reason: "Damaged",
      resolution: "Refund",
      notes: "Updated note",
      refund_expected: true,
      return_sender: expect.objectContaining({ name: "Return Sender" }),
      lines: [expect.objectContaining({ order_item_id: 11, qty: 1 })],
    })));
    expect(createReturn).not.toHaveBeenCalled();
    expect(acceptShippitReturnQuote).not.toHaveBeenCalled();
  });

  it("does not offer a second shipment when a Requested case already has live tracking", async () => {
    vi.mocked(listReturns).mockResolvedValue([{
      id: 112,
      order_id: 134254,
      status: "requested",
      reason: "Size",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      shippit_tracking_number: "PP-ALREADY-LIVE",
      shippit_state: "order_placed",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ id: 1, order_item_id: 11, qty: 1 }],
    }]);

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#112")).toBeInTheDocument());
    expect(view.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "View" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "View" }));

    expect(view.getByText(/Status: Requested. Tracking: PP-ALREADY-LIVE/)).toBeInTheDocument();
    expect(view.queryByRole("heading", { name: "Return Case #112" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Get a quote — prices only" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Create Shippit order — New Orders" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Accept quote — create the Shippit order in New Orders" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Request label — this confirms the return and allocates the courier" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Book pickup — book the courier once the sender is ready" })).not.toBeInTheDocument();
    expect(createReturn).not.toHaveBeenCalled();
    expect(acceptShippitReturnQuote).not.toHaveBeenCalled();
    expect(updateReturn).not.toHaveBeenCalled();
  });

  it("shows Edit only beside View for a Requested case that has no live tracking", async () => {
    const base = {
      order_id: 134254,
      reason: "Size",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ id: 1, order_item_id: 11, qty: 1 }],
    };
    vi.mocked(listReturns).mockResolvedValue([
      { ...base, id: 12, status: "requested", shippit_tracking_number: "", shippit_state: "" },
      { ...base, id: 13, status: "requested", shippit_tracking_number: "CANCELLED-TRACK", shippit_state: "cancelled" },
      { ...base, id: 14, status: "requested", return_shipment: { tracking_number: "LIVE-RETURN", state: "order_placed" } },
      { ...base, id: 15, status: "approved", shippit_tracking_number: "PP-APPROVED", shippit_state: "order_placed" },
      { ...base, id: 16, status: "in_transit" },
      { ...base, id: 17, status: "received" },
      { ...base, id: 18, status: "closed" },
    ]);

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#12")).toBeInTheDocument());

    const row = (label: string) => {
      const element = view.getByText(label).closest("tr");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    };

    expect(within(row("#12")).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(within(row("#12")).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(row("#13")).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    ["#14", "#15", "#16", "#17", "#18"].forEach(label => {
      expect(within(row(label)).getByRole("button", { name: "View" })).toBeInTheDocument();
      expect(within(row(label)).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });
  });

  it("prefills the original recipient and leaves the different-sender box unchecked", async () => {
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
      id: 8,
      order_id: 134400,
      status: "requested",
      reason: "",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ order_item_id: 11, qty: 1 }],
    });
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134400,
      return_id: 8,
      parcels: [{ qty: 1, weight_kg: 0.5, length_cm: 10, width_cm: 10, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134400,
      return_id: 8,
      mode: "",
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    });

    const view = render(<ReturnsPage />);
    fireEvent.change(view.getByLabelText("WooCommerce Order ID"), { target: { value: "134400" } });
    fireEvent.click(view.getByRole("button", { name: "Load Returnable Items" }));
    const senderBox = await view.findByLabelText("Use a different return sender address");
    expect(senderBox).not.toBeChecked();
    const address = view.getByLabelText(/Address Line 1/);
    expect(address).toHaveValue("1 Original Street");
    expect(address).toBeDisabled();
    expect(view.getByLabelText(/Suburb/)).toHaveValue("Sydney");

    fireEvent.click(senderBox);
    fireEvent.change(view.getByLabelText(/Address Line 1/), { target: { value: "9 Other Street" } });
    fireEvent.click(view.getByLabelText("Use a different return sender address"));
    expect(view.getByLabelText("Use a different return sender address")).not.toBeChecked();
    expect(view.getByLabelText(/Address Line 1/)).toHaveValue("1 Original Street");
    expect(view.getByLabelText(/Address Line 1/)).toBeDisabled();

    fireEvent.change(view.getAllByRole("spinbutton")[1], { target: { value: "1" } });
    fireEvent.click(view.getByRole("button", { name: "Save Return Case" }));
    await waitFor(() => expect(createReturn).toHaveBeenCalledWith(expect.objectContaining({
      return_sender: expect.objectContaining({
        name: "Test Customer",
        address_line_1: "1 Original Street",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
      }),
    })));
  });

  it("does not tick the sender box when a Requested case has an empty saved sender", async () => {
    const requestedCase = {
      id: 12,
      order_id: 134254,
      status: "requested" as const,
      reason: "Size",
      resolution: "",
      refund_expected: false,
      refund_reference: "",
      notes: "",
      return_sender: {
        name: "",
        address_line_1: "",
        suburb: "",
        state: "",
        postcode: "",
        country_code: "",
      },
      shippit_tracking_number: "",
      shippit_state: "",
      created_at: "2026-10-08",
      updated_at: "2026-10-08",
      lines: [{ id: 1, order_item_id: 11, product_id: 21, sku: "SKU-1", product_name: "Test Product", qty: 1 }],
    };
    vi.mocked(listReturns).mockResolvedValue([requestedCase]);
    vi.mocked(getReturnableOrderItems).mockResolvedValue({
      order: {
        id: 134254,
        number: "134254",
        status: "completed",
        currency: "AUD",
        date_created: null,
        customer: { email: "customer@example.test", first_name: "Test", last_name: "Customer" },
        shipping_address: {
          first_name: "Test",
          last_name: "Customer",
          company: "",
          address_1: "1 Example Street",
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
        existing_return_qty: 1,
        returnable_qty: 0,
        unit_price: 10,
        weight_g: 500,
        length_cm: 10,
        width_cm: 10,
        height_cm: 10,
      }],
    });
    vi.mocked(previewReturnParcels).mockResolvedValue({
      order_id: 134254,
      return_id: 12,
      parcels: [{ qty: 1, weight_kg: 0.5, length_cm: 10, width_cm: 10, height_cm: 10 }],
      decisions: [],
      parcel_source: "ny_recommendation",
    });
    vi.mocked(getShipmentMode).mockResolvedValue({
      order_id: 134254,
      return_id: 12,
      mode: "",
      mode_locked: false,
      workflow_stage: "not_quoted",
      label_ready: false,
      price: null,
    });

    const view = render(<ReturnsPage />);
    await waitFor(() => expect(view.getByText("#12")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Edit" }));
    const senderBox = await view.findByLabelText("Use a different return sender address");
    expect(senderBox).not.toBeChecked();
    expect(view.getByLabelText(/Address Line 1/)).toHaveValue("1 Example Street");
    expect(view.getByLabelText(/Address Line 1/)).toBeDisabled();
    expect(view.getByLabelText(/Suburb/)).toHaveValue("Sydney");
  });
});
