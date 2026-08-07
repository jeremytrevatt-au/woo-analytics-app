import { fetchJson } from "./httpClient";

export type AllocationStatus = "active" | "paused" | "closed" | "cancelled";
export type ReservationStatus = "reserved" | "consumed" | "released" | "cancelled";

export type PreorderAllocation = {
  id: number;
  po_id: number | null;
  po_line_id: number | null;
  product_id: number;
  variation_id: number;
  wsvi_group_id: string;
  sku: string;
  product_name: string;
  allocated_qty: number;
  reserved_qty: number;
  consumed_qty: number;
  released_qty: number;
  available_qty: number;
  status: AllocationStatus;
  eta_date: string | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  reservations?: PreorderReservation[];
};

export type PreorderReservation = {
  id: number;
  allocation_id: number;
  reservation_key: string;
  order_id: number | null;
  order_item_id: number | null;
  product_id: number;
  variation_id: number;
  wsvi_group_id: string;
  sku: string;
  qty: number;
  status: ReservationStatus;
  notes?: string;
  reserved_at?: string;
  updated_at?: string;
};

export type PreorderDiagnostics = {
  allocations_by_status: Array<{ status: AllocationStatus; count: number | string }>;
  reservations_by_status: Array<{ status: ReservationStatus; count: number | string }>;
  over_allocated: PreorderAllocation[];
  recent_events: Array<Record<string, unknown>>;
};

export type PreorderAvailabilitySummary = {
  stock_target_key: string;
  sku: string;
  product_name: string;
  product_id: number;
  variation_id: number;
  wsvi_group_id: string;
  allocated_qty: number;
  reserved_qty: number;
  consumed_qty: number;
  released_qty: number;
  available_qty: number;
  allocation_count: number;
};

export type PurchaseOrderPreorderLineSummary = {
  po_line_id: number;
  sku: string;
  product_name: string;
  qty: number;
  allocations: PreorderAllocation[];
  availability: PreorderAvailabilitySummary[];
};

export type PurchaseOrderPreorderSummary = {
  po_id: number;
  po_number?: string;
  allocations: PreorderAllocation[];
  line_summaries: PurchaseOrderPreorderLineSummary[];
  availability: PreorderAvailabilitySummary[];
};

export type BulkAllocatePurchaseOrderResult = {
  po_id: number;
  po_number?: string;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  created: PreorderAllocation[];
  updated: PreorderAllocation[];
  skipped: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  availability: PreorderAvailabilitySummary[];
};

export type ManualHoldResult = {
  allocation: PreorderAllocation;
  manual_hold_qty: number;
  previous_qty: number;
  delta: number;
  reservations: PreorderReservation[];
};

export type PreorderAllocationCreatePayload = {
  po_line_id?: number;
  po_id?: number;
  product_id?: number;
  variation_id?: number;
  wsvi_group_id?: string;
  sku?: string;
  product_name?: string;
  allocated_qty: number;
  status?: AllocationStatus;
  eta_date?: string;
  notes?: string;
};

export type PreorderAllocationUpdatePayload = {
  allocated_qty?: number;
  status?: AllocationStatus;
  eta_date?: string | null;
  notes?: string | null;
};

export type PreorderReservationCreatePayload = {
  allocation_id: number;
  qty: number;
  reservation_key?: string;
  order_id?: number;
  order_item_id?: number;
  notes?: string;
};

export type PreorderReservationUpdatePayload = {
  status: ReservationStatus;
  notes?: string | null;
};

export type ManualHoldPayload = {
  qty: number;
  notes?: string | null;
};

export type PreorderAllocationFilters = {
  status?: AllocationStatus;
  product_id?: number;
  variation_id?: number;
  wsvi_group_id?: string;
  po_id?: number;
};

export type PreorderReservationFilters = {
  allocation_id?: number;
  order_id?: number;
  order_item_id?: number;
  product_id?: number;
  variation_id?: number;
  status?: ReservationStatus;
  wsvi_group_id?: string;
};

function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.append(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export const preordersApi = {
  async diagnostics(): Promise<PreorderDiagnostics> {
    return fetchJson<PreorderDiagnostics>("/api/v1/preorders/diagnostics");
  },

  async getPurchaseOrderSummary(poId: number): Promise<PurchaseOrderPreorderSummary> {
    return fetchJson<PurchaseOrderPreorderSummary>(`/api/v1/preorders/purchase-orders/${poId}/allocations`);
  },

  async bulkAllocatePurchaseOrder(poId: number): Promise<BulkAllocatePurchaseOrderResult> {
    return fetchJson<BulkAllocatePurchaseOrderResult>(`/api/v1/preorders/purchase-orders/${poId}/bulk-allocate`, {
      method: "POST",
      body: JSON.stringify({ status: "active" })
    });
  },

  async listAllocations(filters: PreorderAllocationFilters = {}): Promise<PreorderAllocation[]> {
    return fetchJson<PreorderAllocation[]>(`/api/v1/preorders/allocations${buildQuery(filters)}`);
  },

  async getAllocation(id: number, includeReservations = false): Promise<PreorderAllocation> {
    return fetchJson<PreorderAllocation>(
      `/api/v1/preorders/allocations/${id}${buildQuery({ include_reservations: String(includeReservations) })}`
    );
  },

  async createAllocation(payload: PreorderAllocationCreatePayload): Promise<PreorderAllocation> {
    return fetchJson<PreorderAllocation>("/api/v1/preorders/allocations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async updateAllocation(id: number, payload: PreorderAllocationUpdatePayload): Promise<PreorderAllocation> {
    return fetchJson<PreorderAllocation>(`/api/v1/preorders/allocations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  async setManualHold(id: number, payload: ManualHoldPayload): Promise<ManualHoldResult> {
    return fetchJson<ManualHoldResult>(`/api/v1/preorders/allocations/${id}/manual-hold`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  async deleteAllocation(id: number): Promise<{ deleted: boolean }> {
    return fetchJson<{ deleted: boolean }>(`/api/v1/preorders/allocations/${id}`, {
      method: "DELETE"
    });
  },

  async listReservations(filters: PreorderReservationFilters = {}): Promise<PreorderReservation[]> {
    return fetchJson<PreorderReservation[]>(`/api/v1/preorders/reservations${buildQuery(filters)}`);
  },

  async createReservation(payload: PreorderReservationCreatePayload): Promise<PreorderReservation> {
    return fetchJson<PreorderReservation>("/api/v1/preorders/reservations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async updateReservation(id: number, payload: PreorderReservationUpdatePayload): Promise<PreorderReservation> {
    return fetchJson<PreorderReservation>(`/api/v1/preorders/reservations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
};
