import { fetchJson } from "./httpClient";

export type PackingQuoteParcel = {
  qty: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type PackingQuoteResponse = {
  name: string;
  method: string;
  url: string;
  status_code: number;
  duration_ms: number;
  body: unknown;
};

export type PackingShippitOrderParcel = {
  source_index?: number;
  qty: number;
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type PackingShippitOrderResponse = {
  order_id: number;
  has_shippit_order: boolean;
  can_edit: boolean;
  shippit_tracking_number?: string | null;
  tracking_source?: string | null;
  shippit_state?: string | null;
  sync_status?: string;
  is_shippit_shipping?: boolean;
  is_shippit_live_quote?: boolean;
  mapped_shippit_service?: string | null;
  shipping_methods?: Array<Record<string, unknown>>;
  parcels: PackingShippitOrderParcel[];
  parcel_attributes?: unknown[];
  product_attributes?: unknown[];
  message?: string;
  ny_parcel_update_status?: string;
  ny_packing_update_status?: string;
};

export async function previewPackingQuote(orderId: number, parcels: PackingQuoteParcel[]): Promise<PackingQuoteResponse> {
  return fetchJson<PackingQuoteResponse>("/api/v1/shippit/packing/quote", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      parcels,
    }),
  });
}

export async function getPackingShippitOrder(orderId: number): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}`);
}

export async function updatePackingShippitOrder(orderId: number, parcels: PackingQuoteParcel[]): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}`, {
    method: "PUT",
    body: JSON.stringify({ parcels }),
  });
}
