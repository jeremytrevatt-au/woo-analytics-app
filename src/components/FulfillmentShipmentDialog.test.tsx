import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFulfillment, previewFulfillment } from "../api/fulfillmentApi";
import FulfillmentShipmentDialog from "./FulfillmentShipmentDialog";

vi.mock("../api/fulfillmentApi", () => ({
  previewFulfillment: vi.fn(),
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
      parcels: [],
      existing_shippit: [{ order_id: 101, has_tracking: false, tracking_number: null }],
      requires_cancellation: false,
      address_fingerprint: "safe",
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
            product_weight: 1.5,
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
    fireEvent.click(view.getByRole("button", { name: "Create shipment" }));

    await waitFor(() => expect(createFulfillment).toHaveBeenCalledOnce());
    expect(createFulfillment).toHaveBeenCalledWith(expect.objectContaining({
      order_ids: [101],
      items: [{ order_id: 101, order_item_id: 55, quantity: 2 }],
      parcels: [{ qty: 1, weight_kg: 3, length_cm: 20, width_cm: 10, height_cm: 5 }],
    }));
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(await view.findByText(/tracking TRACK-1/)).toBeInTheDocument();
  });
});
