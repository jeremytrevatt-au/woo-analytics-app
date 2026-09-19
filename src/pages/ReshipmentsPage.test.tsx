import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReshipment,
  getReshipmentSource,
  previewReshipmentParcels,
  quoteReshipment,
} from "../api/reshipmentsApi";
import ReshipmentsPage from "./ReshipmentsPage";

vi.mock("../api/reshipmentsApi", () => ({
  createReshipment: vi.fn(),
  getReshipmentSource: vi.fn(),
  previewReshipmentParcels: vi.fn(),
  quoteReshipment: vi.fn(),
}));

vi.mock("../components/ProductIndexProvider", () => ({
  useProductIndex: () => ({ products: [], loading: false, error: null }),
}));

describe("ReshipmentsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates an omitted-item replacement without decrementing stock twice", async () => {
    vi.mocked(getReshipmentSource).mockResolvedValue({
      order: {
        id: 101,
        number: "101",
        status: "delivered",
        status_label: "Delivered",
        currency: "AUD",
        customer: "Test Customer",
        email: "test@example.test",
        phone: "0491570006",
        shipping_address: "1 Test Street",
      },
      destination: {
        first_name: "Test",
        last_name: "Customer",
        company: "",
        address_1: "1 Test Street",
        address_2: "",
        city: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "AU",
        email: "test@example.com",
        phone: "0491570006",
      },
      items: [{
        order_item_id: 11,
        product_id: 21,
        variation_id: 0,
        sku: "SKU-1",
        name: "Test Product",
        quantity: 1,
        already_reshipped_qty: 0,
        weight_kg: 0.5,
        length_cm: 20,
        width_cm: 15,
        height_cm: 10,
      }],
      previous_reshipments: [],
    });
    vi.mocked(quoteReshipment).mockResolvedValue({
      name: "reshipment_quote",
      method: "POST",
      url: "https://app.staging.shippit.com/api/3/quotes",
      status_code: 200,
      duration_ms: 10,
      body: {
        response: [
          {
            success: false,
            courier_type: "AramexAuNz",
            service_level: "standard",
            error: "Destination suburb is invalid.",
            quotes: null,
          },
          {
            success: true,
            courier_type: "ClickAndCollect",
            courier_name: "Click & Collect",
            service_level: "click_and_collect",
            quotes: [{ price: 0, estimated_transit_time: "0 business days" }],
          },
        ],
      },
    });
    vi.mocked(createReshipment).mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000001",
      source_order_id: 101,
      replacement_order_id: 202,
      woo_fulfillment_id: 303,
      status: "completed",
      tracking_number: "TRACKING",
      tracking_url: "https://tracking.example.test/TRACKING",
      courier_name: "Click & Collect",
      shipment_state: "",
      quoted_cost: 0,
      currency: "AUD",
    });
    vi.mocked(previewReshipmentParcels).mockResolvedValue({
      parcels: [
        {
          qty: 1,
          weight_kg: 0.5,
          length_cm: 20,
          width_cm: 15,
          height_cm: 10,
        },
      ],
      decisions: [{ product_id: 21, calculated: true }],
    });

    const view = render(<ReshipmentsPage />);
    fireEvent.change(view.getByLabelText("Source WooCommerce Order ID"), { target: { value: "101" } });
    fireEvent.click(view.getByRole("button", { name: "Load Source Order" }));
    await waitFor(() => expect(view.getByText("Test Product")).toBeInTheDocument());

    fireEvent.click(view.getByRole("button", { name: "Add Missing Item" }));
    expect(view.getByText("No additional reduction")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Use Dimensions" })).not.toBeInTheDocument();
    await waitFor(() => expect(view.getByText("1 parcel(s) calculated using NY Shipping rules.")).toBeInTheDocument());
    fireEvent.change(view.getByDisplayValue("0.5"), { target: { value: "0.6" } });
    expect(view.getByText(/Parcel configuration has been manually adjusted/)).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Get Shippit Quotes" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Selected" })).toBeInTheDocument());
    expect(view.getByText("1 usable quote(s) returned; 1 carrier quote failure(s).")).toBeInTheDocument();
    expect(view.getByText("Destination suburb is invalid.")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: "Create Replacement Order and Submit Shipment" }));
    expect(view.getByText(/creates a real zero-value WooCommerce order/)).toBeInTheDocument();
    expect(createReshipment).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Create Order and Submit" }));

    await waitFor(() => expect(createReshipment).toHaveBeenCalledWith(expect.objectContaining({
      source_order_id: 101,
      lines: [{
        source_order_item_id: 11,
        product_id: 21,
        quantity: 1,
        reason: "missing_from_package",
        inventory_effect: "already_accounted",
      }],
      parcels: [{
        qty: 1,
        weight_kg: 0.6,
        length_cm: 20,
        width_cm: 15,
        height_cm: 10,
      }],
      parcel_source: "manual",
      notify_customer: true,
    })));
    expect(view.getByText(/Replacement order #202 created/)).toBeInTheDocument();
  });
});
