import { fetchJson } from "./httpClient";

export type ReturnStatus = "requested" | "approved" | "received" | "closed" | "cancelled";

export type ReturnLine = {
  id?: number;
  return_id?: number;
  order_item_id?: number | null;
  product_id?: number;
  variation_id?: number;
  sku?: string;
  product_name?: string;
  qty: number;
  condition_status?: string;
  restock_status?: string;
  restocked_qty?: number;
  notes?: string;
};

export type ReturnCase = {
  id: number;
  order_id: number;
  status: ReturnStatus;
  reason: string;
  resolution: string;
  refund_expected: boolean | number;
  refund_reference: string;
  notes: string;
  created_at: string;
  updated_at: string;
  lines: ReturnLine[];
};

export type ReturnableOrderItem = {
  order_item_id: number;
  product_id: number;
  variation_id: number;
  sku: string;
  product_name: string;
  ordered_qty: number;
  refunded_qty: number;
  existing_return_qty: number;
  returnable_qty: number;
  unit_price: number;
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type ReturnableOrderResponse = {
  order: {
    id: number;
    number: string;
    status: string;
    date_created: string | null;
    customer: {
      email: string;
      first_name: string;
      last_name: string;
    };
    shipping_address: Record<string, string>;
  };
  items: ReturnableOrderItem[];
};

export type ShippitReturnsProbeResult = {
  name: string;
  method: string | null;
  url: string | null;
  status_code: number | null;
  duration_ms: number;
  body?: unknown;
  error?: string;
};

export type ShippitReturnsProbeResponse = {
  environment: string;
  checked_at: string;
  order_id?: number | null;
  results: ShippitReturnsProbeResult[];
};

export type ReturnCreatePayload = {
  order_id: number;
  status?: ReturnStatus;
  reason?: string;
  resolution?: string;
  refund_expected?: boolean;
  refund_reference?: string;
  notes?: string;
  lines?: ReturnLine[];
};

export type ReturnUpdatePayload = Partial<Omit<ReturnCreatePayload, "order_id">>;

export async function listReturns(params: { orderId?: number; status?: string } = {}): Promise<ReturnCase[]> {
  const query = new URLSearchParams();
  if (params.orderId) query.append("order_id", String(params.orderId));
  if (params.status && params.status !== "all") query.append("status", params.status);
  const qs = query.toString();
  return fetchJson<ReturnCase[]>(`/api/v1/returns${qs ? `?${qs}` : ""}`);
}

export async function createReturn(payload: ReturnCreatePayload): Promise<ReturnCase> {
  return fetchJson<ReturnCase>("/api/v1/returns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReturn(returnId: number, payload: ReturnUpdatePayload): Promise<ReturnCase> {
  return fetchJson<ReturnCase>(`/api/v1/returns/${returnId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getReturnableOrderItems(orderId: number): Promise<ReturnableOrderResponse> {
  return fetchJson<ReturnableOrderResponse>(`/api/v1/shippit/returns/order/${orderId}/returnable-items`);
}

export async function probeShippitReturnsEndpoints(params: { orderId?: number; trackingNumber?: string } = {}): Promise<ShippitReturnsProbeResponse> {
  return fetchJson<ShippitReturnsProbeResponse>("/api/v1/shippit/returns/diagnostics/probe", {
    method: "POST",
    body: JSON.stringify({ order_id: params.orderId, tracking_number: params.trackingNumber || undefined }),
  });
}
