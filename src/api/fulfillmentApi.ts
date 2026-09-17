import { fetchJson } from "./httpClient";

export type FulfillmentLine = {
  order_id: number;
  order_item_id: number;
  quantity: number;
  ordered_quantity: number;
  refunded_quantity: number;
  fulfilled_quantity: number;
  remaining_quantity: number;
  sku: string;
  name: string;
};

export type FulfillmentParcel = {
  qty: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type FulfillmentPreview = {
  mode: "partial" | "combined";
  orders: Array<{
    order_id: number;
    number: string;
    recipient: string;
    address: string;
    shipping_methods: string[];
  }>;
  items: FulfillmentLine[];
  parcels: FulfillmentParcel[];
  existing_shippit: Array<{
    order_id: number;
    has_tracking: boolean;
    tracking_number: string | null;
  }>;
  requires_cancellation: boolean;
  address_fingerprint: string;
};

export type FulfillmentOperation = {
  operation_id: string;
  mode: "partial" | "combined";
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  result_json: Record<string, unknown> | null;
  sources: Array<{
    order_id: number;
    order_item_id: number;
    quantity: number;
    woo_fulfillment_id: number | null;
  }>;
};

export async function previewFulfillment(orderIds: number[]): Promise<FulfillmentPreview> {
  return fetchJson<FulfillmentPreview>("/api/v1/packing/fulfillment/preview", {
    method: "POST",
    body: JSON.stringify({
      order_ids: orderIds,
      items: [],
      parcels: [],
    }),
  });
}

export async function createFulfillment(payload: {
  operation_id: string;
  order_ids: number[];
  items: Array<{ order_id: number; order_item_id: number; quantity: number }>;
  parcels: FulfillmentParcel[];
  cancel_existing_shipments: boolean;
  notify_customer: boolean;
}): Promise<FulfillmentOperation> {
  return fetchJson<FulfillmentOperation>("/api/v1/packing/fulfillment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
