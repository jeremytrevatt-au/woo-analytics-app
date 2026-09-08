import { fetchJson } from "./httpClient";

export type CrmNoteStatus = "open" | "acknowledged" | "completed" | "dismissed";

export type CrmNote = {
  id: number;
  customer_id: number;
  customer_key: string;
  customer_email: string;
  customer_phone: string;
  order_id: number;
  trigger_event: string;
  status: CrmNoteStatus;
  reminder_date: string | null;
  note_content: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type CrmNoteCreatePayload = {
  customer_id?: number;
  customer_key?: string;
  customer_email?: string;
  customer_phone?: string;
  order_id?: number;
  trigger_event?: string;
  status?: CrmNoteStatus;
  reminder_date?: string;
  note_content: string;
};

export type CrmNoteUpdatePayload = Partial<CrmNoteCreatePayload>;

export type CrmCustomerIdentity = {
  customer_id?: number;
  customer_key?: string;
  customer_email?: string;
  customer_phone?: string;
};

export type CrmCustomerProfile = {
  profile: {
    customer_id?: number;
    customer_key?: string;
    customer_name?: string;
    billing_first_name?: string;
    billing_email?: string;
    billing_phone?: string;
    order_count: number;
    lifetime_value: number;
    last_order_date?: string | null;
  };
  orders: Array<Record<string, any> & { lines?: Array<Record<string, any>> }>;
  notes: CrmNote[];
};

function appendIdentityParams(query: URLSearchParams, identity: CrmCustomerIdentity): void {
  if (identity.customer_id !== undefined && identity.customer_id !== null) query.append("customer_id", String(identity.customer_id));
  if (identity.customer_key) query.append("customer_key", identity.customer_key);
  if (identity.customer_email) query.append("customer_email", identity.customer_email);
  if (identity.customer_phone) query.append("customer_phone", identity.customer_phone);
}

export async function listCrmNotes(params: CrmCustomerIdentity & { order_id?: number; trigger_event?: string; status?: string } = {}): Promise<CrmNote[]> {
  const query = new URLSearchParams();
  appendIdentityParams(query, params);
  if (params.order_id !== undefined && params.order_id !== null) query.append("order_id", String(params.order_id));
  if (params.trigger_event && params.trigger_event !== "all") query.append("trigger_event", params.trigger_event);
  if (params.status && params.status !== "all") query.append("status", params.status);
  const qs = query.toString();
  return fetchJson<CrmNote[]>(`/api/v1/crm/notes${qs ? `?${qs}` : ""}`);
}

export async function createCrmNote(payload: CrmNoteCreatePayload): Promise<CrmNote> {
  return fetchJson<CrmNote>("/api/v1/crm/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCrmNote(noteId: number, payload: CrmNoteUpdatePayload): Promise<CrmNote> {
  return fetchJson<CrmNote>(`/api/v1/crm/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCrmCustomerProfile(identity: CrmCustomerIdentity): Promise<CrmCustomerProfile> {
  const query = new URLSearchParams();
  appendIdentityParams(query, identity);
  return fetchJson<CrmCustomerProfile>(`/api/v1/crm/customer-profile?${query.toString()}`);
}
