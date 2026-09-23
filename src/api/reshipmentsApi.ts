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

export type ReshipmentParcelPreview = {
  parcels: ReshipmentParcel[];
  decisions: Array<Record<string, unknown>>;
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
  change_version?: number;
  modified_at?: string | null;
  cancelled_at?: string | null;
  can_modify?: boolean;
  can_cancel?: boolean;
  action_note?: string;
  lines?: Array<{
    source_order_item_id: number | null;
    product_id: number;
    variation_id: number;
    quantity: number;
    reason: ReshipmentReason;
    inventory_effect: InventoryEffect;
    sku: string;
    product_name: string;
  }>;
  request_json?: {
    destination?: ReshipmentDestination;
    parcels?: ReshipmentParcel[];
  };
};

export type RecentReshipment = ReshipmentOperation & {
  source_order_number: string;
  replacement_order_number: string;
  billing_name: string;
  is_unprocessed: boolean;
  created_at: string;
  item_summary: Array<{
    name: string;
    sku: string;
    quantity: number;
  }>;
  crm_notes: Array<{
    id: number;
    order_id: number;
    trigger_event: string;
    status: string;
    reminder_date: string;
    note_content: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  }>;
};

export function getReshipmentSource(orderId: number): Promise<ReshipmentSource> {
  return fetchJson<ReshipmentSource>(`/api/v1/shipping/reshipments/source/${orderId}`);
}

export function listRecentReshipments(limit = 25): Promise<{ reshipments: RecentReshipment[] }> {
  return fetchJson<{ reshipments: RecentReshipment[] }>(
    `/api/v1/shipping/reshipments/recent?limit=${limit}`,
  );
}

export function quoteReshipment(payload: {
  operation_id?: string;
  source_order_id: number;
  lines: ReshipmentLineRequest[];
  parcels: ReshipmentParcel[];
  destination: ReshipmentDestination;
  parcel_source: "recommended" | "manual";
}): Promise<PackingQuoteResponse> {
  return fetchJson<PackingQuoteResponse>("/api/v1/shipping/reshipments/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function previewReshipmentParcels(payload: {
  operation_id?: string;
  source_order_id: number;
  lines: ReshipmentLineRequest[];
  destination: ReshipmentDestination;
}): Promise<ReshipmentParcelPreview> {
  return fetchJson<ReshipmentParcelPreview>("/api/v1/shipping/reshipments/parcel-preview", {
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
  parcel_source: "recommended" | "manual";
  quote_selection: PackingQuoteSelection;
  notify_customer: boolean;
}): Promise<ReshipmentOperation> {
  return fetchJson<ReshipmentOperation>("/api/v1/shipping/reshipments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ReshipmentCancellationPreview = {
  operation_id: string;
  replacement_order_id: number | null;
  tracking_number: string;
  shipment_state: string;
  can_cancel: boolean;
  blocked_reason: string;
  stock_restore_quantity: number;
  already_accounted_quantity: number;
  lines: NonNullable<ReshipmentOperation["lines"]>;
};

export function getReshipmentOperation(operationId: string): Promise<ReshipmentOperation> {
  return fetchJson<ReshipmentOperation>(`/api/v1/shipping/reshipments/operation/${operationId}`);
}

export function previewReshipmentCancellation(operationId: string): Promise<ReshipmentCancellationPreview> {
  return fetchJson<ReshipmentCancellationPreview>(
    `/api/v1/shipping/reshipments/operation/${operationId}/cancel-preview`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function cancelReshipment(operationId: string): Promise<ReshipmentOperation> {
  return fetchJson<ReshipmentOperation>(
    `/api/v1/shipping/reshipments/operation/${operationId}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function modifyReshipment(operationId: string, payload: {
  change_id: string;
  lines: ReshipmentLineRequest[];
  parcels: ReshipmentParcel[];
  destination: ReshipmentDestination;
  parcel_source: "recommended" | "manual";
  quote_selection: PackingQuoteSelection;
}): Promise<ReshipmentOperation> {
  return fetchJson<ReshipmentOperation>(
    `/api/v1/shipping/reshipments/operation/${operationId}/modify`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}
