import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFulfillment, previewFulfillment, quoteFulfillment } from "../api/fulfillmentApi";
import FulfillmentShipmentDialog from "./FulfillmentShipmentDialog";

vi.mock("../api/fulfillmentApi", () => ({
  previewFulfillment: vi.fn(),
  quoteFulfillment: vi.fn(),
  createFulfillment: vi.fn(),
}));

describe("FulfillmentShipmentDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates one tracked shipment from selected remaining quantities", async () => {
    vi.mocked(previewFulfillment).mockResolvedValue({
      mode: "partial",
      orders: [{ order_id: 101, number: "101", recipient: "Test Customer", address: "1 Test Street", shipping_methods: ["Parcel Post"] }],
      items: [{
        order_id: 101,
        order_item_id: 55,
        quantity: 2,
        ordered_quantity: 3,
        refunded_quantity: 0,
        fulfilled_quantity: 1,
        remaining_quantity: 2,
        sku: "SKU-1",
        name: "Test Product",
      }],
      parcels: [{ qty: 1, weight_kg: 3, length_cm: 20, width_cm: 10, height_cm: 5 }],
      existing_shippit: [{
        order_id: 101,
        has_tracking: true,
        tracking_number: "OLD-COMPLETED",
        state: "completed",
        is_history: true,
        requires_cancellation: false,
      }],
      requires_cancellation: false,
      address_fingerprint: "safe",
    });
    vi.mocked(quoteFulfillment).mockResolvedValue({
      name: "partial",
      method: "POST",
      url: "https://example.test",
      status_code: 200,
      duration_ms: 10,
      body: {
        response: [{
          courier_type: "standard",
          courier_name: "Carrier",
          quotes: [{ price: 12.5 }],
        }],
      },
    });
    vi.mocked(createFulfillment).mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000001",
      mode: "partial",
      status: "completed",
      tracking_number: "TRACK-1",
      tracking_url: "https://example.test/TRACK-1",
      result_json: null,
      sources: [{ order_id: 101, order_item_id: 55, quantity: 2, woo_fulfillment_id: 7 }],
    });

    const onCompleted = vi.fn();
    const view = render(
      <FulfillmentShipmentDialog
        open
        orders={[{
          order_id: 101,
          lines: [{
            order_item_id: 55,
            product_weight: 1500,
            product_length: 20,
            product_width: 10,
            product_height: 5,
          }],
        }]}
        onClose={vi.fn()}
        onCompleted={onCompleted}
      />,
    );

    await waitFor(() => expect(view.getByText(/Test Product/)).toBeInTheDocument());
    expect(view.getByText(/OLD-COMPLETED \(completed\)/)).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Get shipping quotes" }));
    await waitFor(() => expect(view.getByText(/Carrier — \$12.50/)).toBeInTheDocument());
    fireEvent.click(view.getByText(/Carrier — \$12.50/));
    fireEvent.click(view.getByRole("button", { name: "Create quoted shipment" }));

    await waitFor(() => expect(createFulfillment).toHaveBeenCalledOnce());
    expect(createFulfillment).toHaveBeenCalledWith(expect.objectContaining({
      order_ids: [101],
      items: [{ order_id: 101, order_item_id: 55, quantity: 2 }],
      parcels: [{ qty: 1, weight_kg: 3, length_cm: 20, width_cm: 10, height_cm: 5 }],
      cancel_existing_shipments: false,
      quote_selection: expect.objectContaining({ courier_type: "standard", price: 12.5 }),
    }));
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(await view.findByText(/tracking TRACK-1/)).toBeInTheDocument();
  });

  it("books the selected Australia Post postage product", async () => {
    vi.mocked(previewFulfillment).mockResolvedValue({
      mode: "partial",
      orders: [{ order_id: 134677, number: "134677", recipient: "Test Customer", address: "1 Test Street", shipping_methods: ["Standard"] }],
      items: [{
        order_id: 134677,
        order_item_id: 55,
        quantity: 1,
        ordered_quantity: 1,
        refunded_quantity: 0,
        fulfilled_quantity: 0,
        remaining_quantity: 1,
        sku: "SKU-1",
        name: "Test Product",
      }],
      parcels: [{ qty: 1, weight_kg: 1.25, length_cm: 20, width_cm: 10, height_cm: 5 }],
      existing_shippit: [],
      requires_cancellation: false,
      address_fingerprint: "safe",
    });
    vi.mocked(quoteFulfillment).mockResolvedValue({
      name: "fulfillment_quote",
      method: "POST",
      url: "https://example.test",
      status_code: 200,
      duration_ms: 10,
      body: {
        response: [
          {
            carrier_id: "shippit",
            courier_type: "CouriersPlease",
            service_level: "standard",
            courier_name: "Couriers Please",
            quotes: [{ price: 11.5, carrier_id: "shippit" }],
          },
          {
            carrier_id: "australia_post",
            courier_type: "australia_post",
            service_level: "B30",
            product_id: "B30",
            courier_name: "Australia Post Parcel Post (B30)",
            quotes: [{ price: 8.95, carrier_id: "australia_post", product_id: "B30" }],
          },
        ],
      },
    });
    vi.mocked(createFulfillment).mockResolvedValue({
      operation_id: "00000000-0000-4000-8000-000000000002",
      mode: "partial",
      status: "completed",
      tracking_number: "ARTICLE-1",
      tracking_url: "https://auspost.com.au/mypost/track/details/ARTICLE-1",
      result_json: null,
      sources: [{ order_id: 134677, order_item_id: 55, quantity: 1, woo_fulfillment_id: 8 }],
    });

    const view = render(
      <FulfillmentShipmentDialog
        open
        orders={[{ order_id: 134677 }]}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText(/Test Product/)).toBeInTheDocument());
    fireEvent.click(view.getByRole("button", { name: "Get shipping quotes" }));
    await waitFor(() => expect(view.getByText(/Australia Post Parcel Post \(B30\) — \$8.95/)).toBeInTheDocument());
    expect(view.getByText(/Couriers Please — \$11.50/)).toBeInTheDocument();
    fireEvent.click(view.getByText(/Australia Post Parcel Post \(B30\) — \$8.95/));
    fireEvent.click(view.getByRole("button", { name: "Create quoted shipment" }));

    await waitFor(() => expect(createFulfillment).toHaveBeenCalledOnce());
    expect(createFulfillment).toHaveBeenCalledWith(expect.objectContaining({
      quote_selection: expect.objectContaining({
        carrier_id: "australia_post",
        product_id: "B30",
        price: 8.95,
      }),
    }));
  });
});
