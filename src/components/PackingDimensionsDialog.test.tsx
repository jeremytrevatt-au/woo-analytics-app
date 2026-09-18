import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PackingDimensionsDialog from "./PackingDimensionsDialog";

const apiMocks = vi.hoisted(() => ({
  getPackingShippitOrder: vi.fn(),
  previewPackingQuote: vi.fn(),
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
  });
});
