import { fetchJson } from "./httpClient";

export type DocumentMacroSource =
  | "billing_first_name"
  | "shipping_first_name"
  | "billing_last_name"
  | "shipping_last_name"
  | "billing_company"
  | "order_number"
  | "customer_first_name"
  | "return_case_number"
  | "tracking_number"
  | "tracking_url"
  | "carrier_name"
  | "return_instruction"
  | "product_name"
  | "product_sku"
  | "quantity"
  | "product_description"
  | "label_url"
  | "po_number"
  | "po_created_date"
  | "po_supplier_name"
  | "po_supplier_firstname"
  | "po_supplier_contact_name"
  | "po_supplier_email"
  | "po_supplier_currency"
  | "po_shipping_type"
  | "po_lead_time_days"
  | "po_eta_date"
  | "po_supplier_order_number"
  | "po_product_cost"
  | "po_shipping_cost"
  | "po_cost_adjustments"
  | "po_total_price"
  | "po_line_number"
  | "po_supplier_sku"
  | "po_sku"
  | "po_product_description"
  | "po_qty"
  | "po_supplier_unit_price"
  | "po_line_total";

export type DocumentMacroMapping = {
  id?: number;
  token: string;
  source_key: DocumentMacroSource;
  is_required: boolean;
};

export type DocumentTemplate = {
  id: number;
  name: string;
  trigger_type: string;
  match_value: string;
  google_drive_url: string;
  enabled: boolean | number;
  notes: string;
  macro_mappings?: DocumentMacroMapping[];
  created_at: string;
  updated_at: string;
};

export type DocumentTemplateCreatePayload = {
  name: string;
  trigger_type: string;
  match_value?: string;
  google_drive_url: string;
  enabled?: boolean;
  notes?: string;
  macro_mappings?: DocumentMacroMapping[];
};

export type DocumentTemplateUpdatePayload = Partial<DocumentTemplateCreatePayload>;

export async function listDocumentTemplates(params: { triggerType?: string; enabled?: string } = {}): Promise<DocumentTemplate[]> {
  const query = new URLSearchParams();
  if (params.triggerType && params.triggerType !== "all") query.append("trigger_type", params.triggerType);
  if (params.enabled && params.enabled !== "all") query.append("enabled", params.enabled);
  const qs = query.toString();
  return fetchJson<DocumentTemplate[]>(`/api/v1/document-templates${qs ? `?${qs}` : ""}`);
}

export async function createDocumentTemplate(payload: DocumentTemplateCreatePayload): Promise<DocumentTemplate> {
  return fetchJson<DocumentTemplate>("/api/v1/document-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocumentTemplate(templateId: number, payload: DocumentTemplateUpdatePayload): Promise<DocumentTemplate> {
  return fetchJson<DocumentTemplate>(`/api/v1/document-templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
