import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PackingDimensionsDialog from "./PackingDimensionsDialog";

const apiMocks = vi.hoisted(() => ({
  bookPackingShippitOrder: vi.fn(),
  getPackingShippitOrder: vi.fn(),
  previewPackingQuote: vi.fn(),
  printPackingShippitLabel: vi.fn(),
  updatePackingShippitOrder: vi.fn(),
}));

vi.mock("../api/shippitPackingApi", () => apiMocks);

const destination = {
  address_1: "1 Martin Place",
  address_2: "",
  city: "Sydney",
  state: "NSW",
  postcode: "2000",
  country: "AU",
};

describe("PackingDimensionsDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("allows an Australia Post order to enter parcels and request quotes", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 101,
      has_shippit_order: false,
      can_edit: false,
      shipping_methods: [{ name: "Australia Post Parcel Post" }],
      parcels: [],
      destination,
      message: "Shippit Order doesn't exist - check Australia Post.",
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: { response: [] },
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 101 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByLabelText("Weight g")).toBeInTheDocument());
    fireEvent.change(view.getByLabelText("Weight g"), { target: { value: "1000" } });
    fireEvent.change(view.getByLabelText("Length cm"), { target: { value: "30" } });
    fireEvent.change(view.getByLabelText("Width cm"), { target: { value: "20" } });
    fireEvent.change(view.getByLabelText("Height cm"), { target: { value: "10" } });
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));

    await waitFor(() => expect(apiMocks.previewPackingQuote).toHaveBeenCalledWith(
      101,
      [{ qty: 1, weight_kg: 1, length_cm: 30, width_cm: 20, height_cm: 10 }],
      destination,
    ));
    expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeDisabled();
    expect(apiMocks.updatePackingShippitOrder).not.toHaveBeenCalled();
    expect(apiMocks.bookPackingShippitOrder).not.toHaveBeenCalled();
  });

  it("creates a Shippit order from a selected quote when none exists and does not book it", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 109,
      has_shippit_order: false,
      can_edit: false,
      can_finalise_reserve_shipping: false,
      source_carrier: "australia_post",
      is_shippit_shipping: false,
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 1.2, length_cm: 30, width_cm: 20, height_cm: 10 },
      ],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Couriers Please",
          courier_type: "couriers_please",
          quotes: [{ service_level: "standard", price: 9.95 }],
        }],
      },
    });
    apiMocks.updatePackingShippitOrder.mockResolvedValue({
      order_id: 109,
      action: "create_shippit_order",
      has_shippit_order: true,
      can_edit: true,
      can_book: true,
      tracking_number: "PPNEW109",
      shippit_state: "order_placed",
      shippit_status: "order_placed",
      booking_status: "not_booked",
      parcels: [{ qty: 1, weight_g: 1200, length_cm: 30, width_cm: 20, height_cm: 10 }],
      destination,
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 109 }} onClose={vi.fn()} />,
    );

    const submit = view.getByRole("button", { name: "Submit Selected Quote" });
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(apiMocks.updatePackingShippitOrder).toHaveBeenCalledWith(
      109,
      [{ qty: 1, weight_kg: 1.2, length_cm: 30, width_cm: 20, height_cm: 10 }],
      expect.objectContaining({ courier_type: "couriers_please", service_level: "standard", price: 9.95 }),
    ));
    expect(apiMocks.bookPackingShippitOrder).not.toHaveBeenCalled();
    expect(await view.findByText(/created in New Orders with tracking PPNEW109/)).toBeInTheDocument();
    expect(view.getByText(/The courier was not booked/)).toBeInTheDocument();
  });

  it("keeps submit disabled when a parcel dimension is missing or the quote request failed", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 110,
      has_shippit_order: false,
      can_edit: false,
      can_finalise_reserve_shipping: false,
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 0.5, length_cm: 20, width_cm: 15, height_cm: 8 },
      ],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 500,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Couriers Please",
          courier_type: "couriers_please",
          quotes: [{ service_level: "standard", price: 9.95 }],
        }],
      },
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 110 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByDisplayValue("500")).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Select Couriers Please quote for $9.95" })).toBeInTheDocument());
    expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeDisabled();

    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Couriers Please",
          courier_type: "couriers_please",
          quotes: [{ service_level: "standard", price: 9.95 }],
        }],
      },
    });
    fireEvent.change(view.getByLabelText("Weight g"), { target: { value: "" } });
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(view.getByText(/positive weight/)).toBeInTheDocument());
    expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeDisabled();
    expect(apiMocks.updatePackingShippitOrder).not.toHaveBeenCalled();
    expect(apiMocks.bookPackingShippitOrder).not.toHaveBeenCalled();
  });

  it("uses authoritative NY Shipping recommendations instead of one parcel per order line", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 103,
      has_shippit_order: false,
      can_edit: false,
      shipping_methods: [{ name: "Australia Post Parcel Post" }],
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 0.52, length_cm: 30, width_cm: 20, height_cm: 12 },
      ],
      destination,
      message: "Shippit Order doesn't exist - check Australia Post.",
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: { response: [] },
    });

    const view = render(
      <PackingDimensionsDialog
        open
        order={{
          order_id: 103,
          lines: [
            {
              order_item_id: 1,
              qty: 2,
              product_weight: 260,
              product_length: 30,
              product_width: 20,
              product_height: 10,
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(view.getByDisplayValue("520")).toBeInTheDocument());
    expect(view.getByDisplayValue("30")).toBeInTheDocument();
    expect(view.getByDisplayValue("20")).toBeInTheDocument();
    expect(view.getByDisplayValue("12")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));

    await waitFor(() => expect(apiMocks.previewPackingQuote).toHaveBeenCalledWith(
      103,
      [{ qty: 1, weight_kg: 0.52, length_cm: 30, width_cm: 20, height_cm: 12 }],
      destination,
    ));
  });

  it("does not duplicate bundle child dimensions when the bundle parent has dimensions", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 104,
      has_shippit_order: false,
      can_edit: false,
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 1.5, length_cm: 55, width_cm: 31.5, height_cm: 29 },
      ],
      destination,
    });

    const view = render(
      <PackingDimensionsDialog
        open
        order={{
          order_id: 104,
          lines: [
            {
              order_item_id: 10,
              qty: 1,
              product_weight: 1500,
              product_length: 55,
              product_width: 31.5,
              product_height: 29,
              is_bundle_parent: true,
              bundle_cart_key: "bundle-1",
            },
            {
              order_item_id: 11,
              qty: 1,
              product_weight: 260,
              product_length: 30,
              product_width: 20,
              product_height: 10,
              bundled_by: "bundle-1",
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(view.getByDisplayValue("1500")).toBeInTheDocument());
    expect(view.queryByDisplayValue("260")).not.toBeInTheDocument();
  });

  it("quotes a cancelled Shippit order using selectable cards without radio controls", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 102,
      has_shippit_order: true,
      can_edit: false,
      shippit_tracking_number: "PP102",
      shippit_state: "cancelled",
      parcels: [{ qty: 1, weight_g: 800, length_cm: 25, width_cm: 15, height_cm: 10 }],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Couriers Please",
          courier_type: "couriers_please",
          quotes: [{ service_level: "Standard", price: 12.5 }],
        }],
      },
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 102 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByText(/is cancelled/)).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));

    await waitFor(() => expect(view.getByRole("button", { name: "Select Couriers Please quote for $12.50" })).toBeInTheDocument());
    expect(view.queryByRole("radio")).not.toBeInTheDocument();
    expect(view.getByText("$12.50")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeDisabled();
    expect(apiMocks.updatePackingShippitOrder).not.toHaveBeenCalled();
    expect(apiMocks.bookPackingShippitOrder).not.toHaveBeenCalled();
  });

  it("shows remaining fulfillment scope and carrier quote failures", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 105,
      has_shippit_order: false,
      can_edit: false,
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 0.33, length_cm: 30, width_cm: 20, height_cm: 12 },
      ],
      line_states: [
        { order_item_id: 1, ordered_quantity: 1, fulfilled_quantity: 1, remaining_quantity: 0 },
        { order_item_id: 2, ordered_quantity: 1, fulfilled_quantity: 0, remaining_quantity: 1 },
      ],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Australia Post",
          courier_type: "au_post",
          service_level: "Parcel Post",
          success: false,
          error: "The destination suburb and postcode do not match.",
        }],
      },
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 105 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByText(/1 remaining unit/)).toBeInTheDocument());
    expect(view.getByText(/1 line\(s\) are already fully fulfilled/)).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));

    await waitFor(() => expect(view.getByText(/Australia Post \(Parcel Post\): The destination suburb/)).toBeInTheDocument());
    expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeDisabled();
    expect(apiMocks.updatePackingShippitOrder).not.toHaveBeenCalled();
  });

  it("uses remaining recommendations instead of a completed historical shipment parcel", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 134299,
      has_shippit_order: true,
      can_edit: false,
      tracking_number: "PPOE5pjz86DmL",
      shippit_state: "completed",
      parcels: [
        { qty: 1, weight_g: 9000, length_cm: 90, width_cm: 60, height_cm: 50 },
      ],
      recommended_parcels: [
        { qty: 1, weight_kg: 0.72, length_cm: 15, width_cm: 10, height_cm: 20 },
      ],
      line_states: [
        { order_item_id: 16292, ordered_quantity: 2, fulfilled_quantity: 0, remaining_quantity: 2 },
      ],
      destination,
    });

    const view = render(
      <PackingDimensionsDialog
        open
        order={{ order_id: 134299, order_status: "wc-partial-shipped" }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText(/Historical Shippit shipment PPOE5pjz86DmL is completed/)).toBeInTheDocument());
    expect(view.getByDisplayValue("720")).toBeInTheDocument();
    expect(view.queryByDisplayValue("9000")).not.toBeInTheDocument();
  });

  it("finalises a Reserve balance from a selected packed shipping quote", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 106,
      has_shippit_order: false,
      can_edit: false,
      is_reserve_order: true,
      reserve_state: "awaiting_shipping_quote",
      can_finalise_reserve_shipping: true,
      parcels: [],
      recommended_parcels: [
        { qty: 1, weight_kg: 0.4, length_cm: 25, width_cm: 15, height_cm: 10 },
      ],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Australia Post",
          courier_type: "au_post",
          quotes: [{ service_level: "Parcel Post", price: 14.95 }],
        }],
      },
    });
    apiMocks.updatePackingShippitOrder.mockResolvedValue({
      order_id: 106,
      has_shippit_order: false,
      can_edit: false,
      can_finalise_reserve_shipping: false,
      parcels: [],
      destination,
      reserve_invoice_result: {
        order_id: 106,
        balance_order_ids: [206],
        estimated_incl_tax: 12,
        final_incl_tax: 14.95,
        invoice_dispatched_at: "2026-09-24 00:30:00",
        idempotent: false,
      },
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 106 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByText(/awaiting its final packed shipping quote/)).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Finalise Shipping & Send Invoice" })).toBeEnabled());
    fireEvent.click(view.getByRole("button", { name: "Finalise Shipping & Send Invoice" }));

    await waitFor(() => expect(apiMocks.updatePackingShippitOrder).toHaveBeenCalledWith(
      106,
      [{ qty: 1, weight_kg: 0.4, length_cm: 25, width_cm: 15, height_cm: 10 }],
      expect.objectContaining({ courier_type: "au_post", service_level: "Parcel Post", price: 14.95 }),
    ));
    expect(await view.findByText(/Final shipping \$14.95 was added/)).toBeInTheDocument();
  });

  it("requires quote update before booking and only offers printing when the label is available", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 107,
      has_shippit_order: true,
      can_edit: true,
      can_book: false,
      can_print_label: false,
      parcels: [{ qty: 1, weight_g: 700, length_cm: 25, width_cm: 15, height_cm: 10 }],
      destination,
    });
    apiMocks.previewPackingQuote.mockResolvedValue({
      name: "packing_quote_preview_v3",
      method: "POST",
      url: "https://app.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 25,
      body: {
        response: [{
          courier_name: "Couriers Please",
          courier_type: "couriers_please",
          quotes: [{ service_level: "Standard", price: 11.5 }],
        }],
      },
    });
    apiMocks.updatePackingShippitOrder.mockResolvedValue({
      order_id: 107,
      has_shippit_order: true,
      can_edit: true,
      can_book: true,
      can_print_label: false,
      tracking_number: "PP107",
      shippit_status: "pending",
      parcels: [{ qty: 1, weight_g: 700, length_cm: 25, width_cm: 15, height_cm: 10 }],
      destination,
    });
    apiMocks.bookPackingShippitOrder.mockResolvedValue({
      order_id: 107,
      has_shippit_order: true,
      can_edit: false,
      can_book: false,
      can_print_label: true,
      tracking_number: "PP107",
      shippit_status: "booked",
      booking_status: "confirmed",
      parcels: [],
    });
    apiMocks.printPackingShippitLabel.mockResolvedValue({
      order_id: 107,
      has_shippit_order: true,
      can_edit: false,
      can_book: false,
      can_print_label: true,
      tracking_number: "PP107",
      shippit_status: "booked",
      booking_status: "confirmed",
      parcels: [],
      message: "Label queued for Warehouse Printer.",
    });

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 107 }} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(view.getByRole("button", { name: "Get Shippit Quotes" })).toBeEnabled());
    expect(view.getByRole("button", { name: "Book / Confirm Shipment" })).toBeDisabled();
    expect(view.queryByRole("button", { name: "Print Shipping Label" })).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Submit Selected Quote" })).toBeEnabled());
    fireEvent.click(view.getByRole("button", { name: "Submit Selected Quote" }));

    await waitFor(() => expect(view.getByRole("button", { name: "Book / Confirm Shipment" })).toBeEnabled());
    expect(apiMocks.updatePackingShippitOrder).toHaveBeenCalledWith(
      107,
      [{ qty: 1, weight_kg: 0.7, length_cm: 25, width_cm: 15, height_cm: 10 }],
      expect.objectContaining({ courier_type: "couriers_please", service_level: "Standard", price: 11.5 }),
    );

    fireEvent.click(view.getByRole("button", { name: "Book / Confirm Shipment" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Print Shipping Label" })).toBeEnabled());
    expect(apiMocks.bookPackingShippitOrder).toHaveBeenCalledWith(107);
    expect(view.getByText(/Tracking: PP107.*Shippit status: booked.*Booking status: confirmed/)).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Print Shipping Label" }));
    await waitFor(() => expect(apiMocks.printPackingShippitLabel).toHaveBeenCalledWith(107));
    expect(await view.findByText("Label queued for Warehouse Printer.")).toBeInTheDocument();
  });

  it("prevents duplicate booking requests and shows the server error", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 108,
      has_shippit_order: true,
      can_edit: true,
      can_book: true,
      can_print_label: false,
      parcels: [{ qty: 1, weight_g: 700, length_cm: 25, width_cm: 15, height_cm: 10 }],
      destination,
    });
    apiMocks.bookPackingShippitOrder.mockRejectedValue(
      new Error("API request failed (409): Shipment has already been booked."),
    );

    const view = render(
      <PackingDimensionsDialog open order={{ order_id: 108 }} onClose={vi.fn()} />,
    );

    const bookButton = view.getByRole("button", { name: "Book / Confirm Shipment" });
    await waitFor(() => expect(bookButton).toBeEnabled());
    fireEvent.click(bookButton);
    fireEvent.click(bookButton);

    await waitFor(() => expect(apiMocks.bookPackingShippitOrder).toHaveBeenCalledTimes(1));
    expect(await view.findByText("API request failed (409): Shipment has already been booked.")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Print Shipping Label" })).not.toBeInTheDocument();
  });
});
