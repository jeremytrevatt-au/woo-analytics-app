import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFulfillment, previewFulfillment, quoteFulfillment } from "../api/fulfillmentApi";
import CombinedShipmentDialog from "./CombinedShipmentDialog";

vi.mock("../api/fulfillmentApi", () => ({
  previewFulfillment: vi.fn(),
  quoteFulfillment: vi.fn(),
  createFulfillment: vi.fn(),
}));

describe("CombinedShipmentDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires a quote and cancellation approval before combining", async () => {
    vi.mocked(previewFulfillment).mockResolvedValue({
      mode: "combined",
      orders: [
        { order_id: 101, number: "101", recipient: "Test", address: "1 Test St", shipping_methods: ["Shippit"] },
        { order_id: 102, number: "102", recipient: "Test", address: "1 Test St", shipping_methods: ["Shippit"] },
      ],
      items: [
        { order_id: 101, order_item_id: 1, quantity: 1, ordered_quantity: 1, refunded_quantity: 0, fulfilled_quantity: 0, remaining_quantity: 1, sku: "A", name: "A" },
        { order_id: 102, order_item_id: 2, quantity: 1, ordered_quantity: 1, refunded_quantity: 0, fulfilled_quantity: 0, remaining_quantity: 1, sku: "B", name: "B" },
      ],
      parcels: [],
      existing_shippit: [
        { order_id: 101, has_tracking: true, tracking_number: "OLD-1" },
        { order_id: 102, has_tracking: true, tracking_number: "OLD-2" },
      ],
      requires_cancellation: true,
      address_fingerprint: "same",
    });
    vi.mocked(quoteFulfillment).mockResolvedValue({
      name: "combined",
      method: "POST",
      url: "https://example.test",
      status_code: 200,
      duration_ms: 10,
      body: { response: [{ courier_type: "standard", courier_name: "Carrier", quotes: [{ price: 12.5 }] }] },
    });
    vi.mocked(createFulfillment).mockResolvedValue({
      operation_id: "operation",
      mode: "combined",
      status: "completed",
      tracking_number: "NEW",
      tracking_url: null,
      result_json: null,
      sources: [],
    });

    const onCompleted = vi.fn();
    const view = render(
      <CombinedShipmentDialog
        open
        orders={[
          { order_id: 101, lines: [{ order_item_id: 1, qty: 1, product_weight: 100, product_length: 10, product_width: 10, product_height: 2 }] },
          { order_id: 102, lines: [{ order_item_id: 2, qty: 1, product_weight: 100, product_length: 10, product_width: 10, product_height: 2 }] },
        ]}
        onClose={vi.fn()}
        onCompleted={onCompleted}
      />,
    );

    await waitFor(() => expect(view.getByRole("button", { name: "Get combined shipment quotes" })).toBeEnabled());
    fireEvent.click(view.getByRole("button", { name: "Get combined shipment quotes" }));
    await waitFor(() => expect(view.getByText(/Carrier — \$12.50/)).toBeInTheDocument());
    fireEvent.click(view.getByText(/Carrier — \$12.50/));
    fireEvent.click(view.getByLabelText("Cancel the individual Shippit orders"));
    fireEvent.click(view.getByRole("button", { name: "Create combined shipment" }));

    await waitFor(() => expect(createFulfillment).toHaveBeenCalledOnce());
    expect(createFulfillment).toHaveBeenCalledWith(expect.objectContaining({
      cancel_existing_shipments: true,
      quote_selection: expect.objectContaining({ courier_type: "standard", price: 12.5 }),
    }));
    expect(onCompleted).toHaveBeenCalledOnce();
  });
});
