import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PackingDimensionsDialog from "./PackingDimensionsDialog";

const apiMocks = vi.hoisted(() => ({
  getPackingShippitOrder: vi.fn(),
  previewPackingQuote: vi.fn(),
  updatePackingShippitOrder: vi.fn(),
}));

vi.mock("../api/shippitPackingApi", () => apiMocks);

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
    ));
  });

  it("quotes a cancelled Shippit order using selectable cards without radio controls", async () => {
    apiMocks.getPackingShippitOrder.mockResolvedValue({
      order_id: 102,
      has_shippit_order: true,
      can_edit: false,
      shippit_tracking_number: "PP102",
      shippit_state: "cancelled",
      parcels: [{ qty: 1, weight_g: 800, length_cm: 25, width_cm: 15, height_cm: 10 }],
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
});
