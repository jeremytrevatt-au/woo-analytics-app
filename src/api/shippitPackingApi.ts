import { fetchJson } from "./httpClient";

export type PackingQuoteParcel = {
  qty: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type PackingCarrierQuoteStatus = {
  carrier_id?: string;
  status?: string;
  quote_count?: number;
  error_code?: string | null;
  message?: string | null;
  plugin_version?: string | null;
  product_ids?: string[];
};

export type PackingQuoteResponse = {
  name: string;
  method: string;
  url: string;
  status_code: number;
  duration_ms: number;
  body: unknown;
  carriers?: {
    shippit?: PackingCarrierQuoteStatus;
    australia_post?: PackingCarrierQuoteStatus;
  };
};

export type PackingDestination = {
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

export type PackingQuoteSelection = {
  carrier_id?: string | null;
  product_id?: string | null;
  courier_type?: string | null;
  service_level?: string | null;
  price?: number | null;
  estimated_transit_time?: string | null;
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
  source_carrier?: string | null;
  has_shippit_order: boolean;
  can_edit: boolean;
  tracking_number?: string | null;
  shippit_status?: string | null;
  booking_status?: string | null;
  can_book?: boolean;
  can_print_label?: boolean;
  shippit_tracking_number?: string | null;
  tracking_source?: string | null;
  shippit_state?: string | null;
  courier_type?: string | null;
  courier_allocation?: string | null;
  courier_name?: string | null;
  sync_status?: string;
  is_shippit_shipping?: boolean;
  is_shippit_live_quote?: boolean;
  mapped_shippit_service?: string | null;
  shipping_methods?: Array<Record<string, unknown>>;
  parcels: PackingShippitOrderParcel[];
  recommended_parcels?: PackingQuoteParcel[];
  parcel_decisions?: Array<Record<string, unknown>>;
  line_states?: Array<{
    order_item_id: number;
    product_id: number;
    ordered_quantity: number;
    refunded_quantity: number;
    fulfilled_quantity: number;
    remaining_quantity: number;
  }>;
  destination?: PackingDestination & {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  destination_sanitised?: boolean;
  parcel_attributes?: unknown[];
  product_attributes?: unknown[];
  message?: string;
  ny_parcel_update_status?: string;
  ny_packing_update_status?: string;
  is_reserve_order?: boolean;
  reserve_state?: string | null;
  can_finalise_reserve_shipping?: boolean;
  reserve_invoice_result?: {
    order_id: number;
    balance_order_ids: number[];
    estimated_incl_tax: number;
    final_incl_tax: number;
    invoice_dispatched_at: string;
    idempotent: boolean;
  };
};

export async function previewPackingQuote(
  orderId: number,
  parcels: PackingQuoteParcel[],
  destination: PackingDestination,
): Promise<PackingQuoteResponse> {
  return fetchJson<PackingQuoteResponse>("/api/v1/shippit/packing/quote", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      parcels,
      destination,
    }),
  });
}

export async function getPackingShippitOrder(orderId: number): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}`);
}

export async function updatePackingShippitOrder(
  orderId: number,
  parcels: PackingQuoteParcel[],
  quoteSelection?: PackingQuoteSelection | null,
): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}`, {
    method: "PUT",
    body: JSON.stringify({ parcels, quote_selection: quoteSelection ?? undefined }),
  });
}

export async function bookPackingShippitOrder(orderId: number): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}/book`, {
    method: "POST",
  });
}

export async function printPackingShippitLabel(orderId: number): Promise<PackingShippitOrderResponse> {
  return fetchJson<PackingShippitOrderResponse>(`/api/v1/shippit/packing/order/${orderId}/print-label`, {
    method: "POST",
  });
}
