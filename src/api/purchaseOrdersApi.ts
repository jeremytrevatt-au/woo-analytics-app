import { fetchJson } from "./httpClient";

export type PurchaseOrderLine = {
  id?: number | string;
  product_id: number;
  parent_product_id?: number;
  edit_product_id?: number;
  wsvi_group_id?: string;
  sku: string;
  product_name: string;
  qty: number;
  supplier_sku?: string;
  supplier_unit_price?: number;
  unit_price_aud?: number;
  supplier_total?: number;
  total_aud?: number;
};

export type PurchaseOrder = {
  id?: number;
  po_number: string;
  status: string;
  created_date: string;
  created_by: string;
  supplier_id?: number;
  supplier_name?: string;
  shipping_type: string;
  lead_time_days: number;
  eta_date: string | null;
  preorder_cutoff_date: string | null;
  preorder_campaign?: string;
  supplier_currency: string;
  currency_conversion_rate: number;
  m3: number;
  m3_rate: number;
  pallet_weight: number;
  number_of_pallets: number;
  supplier_order_number: string;
  product_cost_adjustments_origin: number;
  product_cost_origin: number;
  shipping_cost_origin: number;
  total_cost_origin: number;
  shipping_cost_origin_aud: number;
  shipping_cost_aud: number;
  product_cost_aud: number;
  product_cost_adjustments_aud: number;
  total_cost_aud: number;
  drive_link?: string;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderReceiveLinePreview = {
  po_line_id: number;
  sku: string;
  product_name: string;
  ordered_qty: number;
  already_received_qty: number;
  received_qty: number;
  manual_hold_qty: number;
  order_reserved_qty: number;
  reserve_order_reserved_qty?: number;
  stock_delta: number;
  stock_before: number;
  expected_stock_after: number;
  stock_after?: number;
  stock_target_type: string;
  stock_target_product_id?: number;
  stock_target_variation_id?: number;
  wsvi_group_id?: string;
  wsvi_group_name?: string;
  allocation_ids: number[];
  manual_reservation_ids: number[];
  order_reservation_ids: number[];
  reserve_order_reservation_ids?: number[];
};

export type PurchaseOrderReceiveBlockingError = {
  po_line_id?: number;
  sku?: string;
  error_code?: string;
  message?: string;
};

export type PurchaseOrderReceiveStockResult = {
  po_id: number;
  po_number: string;
  current_status: string;
  target_status: string;
  dry_run: boolean;
  receipt_id?: number;
  lines: PurchaseOrderReceiveLinePreview[];
  eligible_orders: Array<{ order_id: number; reservation_ids: number[] }>;
  reserve_orders: Array<{ order_id: number; status: string }>;
  blocked_orders: Array<Record<string, unknown>>;
  blocking_errors: PurchaseOrderReceiveBlockingError[];
  processed_order_ids?: number[];
  reserve_invoice_results?: {
    invoiced_order_ids: number[];
    balance_order_ids: number[];
    errors: Array<{ order_id: number; error_code: string; error_message: string }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePurchaseOrderReceiveStockResult(
  value: unknown,
): PurchaseOrderReceiveStockResult {
  if (!isRecord(value)) {
    throw new Error("Invalid receive-stock response. Reload the purchase order before retrying any stock booking.");
  }
  for (const field of [
    "lines",
    "eligible_orders",
    "reserve_orders",
    "blocked_orders",
    "blocking_errors",
  ]) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Invalid receive-stock response field: ${field}. Reload the purchase order before retrying any stock booking.`);
    }
  }
  if (value.processed_order_ids !== undefined && !Array.isArray(value.processed_order_ids)) {
    throw new Error("Invalid receive-stock response field: processed_order_ids. Reload the purchase order before retrying any stock booking.");
  }
  if (value.reserve_invoice_results !== undefined) {
    if (!isRecord(value.reserve_invoice_results)) {
      throw new Error("Invalid receive-stock response field: reserve_invoice_results. Reload the purchase order before retrying any stock booking.");
    }
    for (const field of ["invoiced_order_ids", "balance_order_ids", "errors"]) {
      if (!Array.isArray(value.reserve_invoice_results[field])) {
        throw new Error(`Invalid receive-stock response field: reserve_invoice_results.${field}. Reload the purchase order before retrying any stock booking.`);
      }
    }
  }
  return value as unknown as PurchaseOrderReceiveStockResult;
}

export const purchaseOrdersApi = {
  async list(status?: string, productId?: number): Promise<PurchaseOrder[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (productId) params.append("product_id", productId.toString());
    
    const qs = params.toString();
    const url = `/api/v1/purchase-orders${qs ? "?" + qs : ""}`;
    return fetchJson<PurchaseOrder[]>(url);
  },

  async get(id: number): Promise<PurchaseOrder> {
    return fetchJson<PurchaseOrder>(`/api/v1/purchase-orders/${id}`);
  },

  async create(po: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return fetchJson<PurchaseOrder>("/api/v1/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(po)
    });
  },

  async update(id: number, po: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return fetchJson<PurchaseOrder>(`/api/v1/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(po)
    });
  },

  async delete(id: number): Promise<{ deleted: boolean }> {
    return fetchJson<{ deleted: boolean }>(`/api/v1/purchase-orders/${id}`, {
      method: "DELETE"
    });
  },

  async receiveStock(id: number, payload: { dry_run: boolean; book_stock?: boolean; process_preorders?: boolean; notes?: string }): Promise<PurchaseOrderReceiveStockResult> {
    const response = await fetchJson<unknown>(`/api/v1/purchase-orders/${id}/receive-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parsePurchaseOrderReceiveStockResult(response);
  }
};
