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
