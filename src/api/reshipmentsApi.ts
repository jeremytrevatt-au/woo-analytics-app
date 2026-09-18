import { fetchJson } from "./httpClient";
import type { PackingQuoteResponse, PackingQuoteSelection } from "./shippitPackingApi";

export type ReshipmentReason = "damaged_transit" | "missing_from_package" | "other";
export type InventoryEffect = "decrement" | "already_accounted";

export type ReshipmentSource = {
  order: {
    id: number;
    number: string;
    status: string;
    status_label: string;
    currency: string;
    customer: string;
    email: string;
    phone: string;
    shipping_address: string;
  };
  destination: ReshipmentDestination;
  items: Array<{
    order_item_id: number;
    product_id: number;
    variation_id: number;
    sku: string;
    name: string;
    quantity: number;
    already_reshipped_qty: number;
    weight_kg: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
  }>;
  previous_reshipments: ReshipmentOperation[];
};

export type ReshipmentDestination = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
};

export type ReshipmentLineRequest = {
  source_order_item_id: number | null;
  product_id: number;
  quantity: number;
  reason: ReshipmentReason;
  inventory_effect: InventoryEffect;
};

export type ReshipmentParcel = {
  qty: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type ReshipmentOperation = {
  operation_id: string;
  source_order_id: number;
  replacement_order_id: number | null;
  woo_fulfillment_id: number | null;
  status: string;
  tracking_number: string;
  tracking_url: string;
  courier_name: string;
  shipment_state: string;
  quoted_cost: number | null;
  currency: string;
};

export function getReshipmentSource(orderId: number): Promise<ReshipmentSource> {
  return fetchJson<ReshipmentSource>(`/api/v1/shipping/reshipments/source/${orderId}`);
}

export function quoteReshipment(payload: {
  source_order_id: number;
  lines: ReshipmentLineRequest[];
  parcels: ReshipmentParcel[];
  destination: ReshipmentDestination;
}): Promise<PackingQuoteResponse> {
  return fetchJson<PackingQuoteResponse>("/api/v1/shipping/reshipments/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createReshipment(payload: {
  operation_id: string;
  source_order_id: number;
  lines: ReshipmentLineRequest[];
  parcels: ReshipmentParcel[];
  destination: ReshipmentDestination;
  quote_selection: PackingQuoteSelection;
  notify_customer: boolean;
}): Promise<ReshipmentOperation> {
  return fetchJson<ReshipmentOperation>("/api/v1/shipping/reshipments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
