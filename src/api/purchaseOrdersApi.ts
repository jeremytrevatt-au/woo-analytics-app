import { fetchJson } from "./httpClient";

export type PurchaseOrderLine = {
  product_id: number;
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
  supplier_currency: string;
  currency_conversion_rate: number;
  m3: number;
  m3_rate: number;
  shipping_cost_origin: number;
  product_cost_origin: number;
  total_cost_origin: number;
  shipping_cost_aud: number;
  product_cost_aud: number;
  product_cost_adjustments_aud: number;
  total_cost_aud: number;
  lines: PurchaseOrderLine[];
};

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
  }
};
