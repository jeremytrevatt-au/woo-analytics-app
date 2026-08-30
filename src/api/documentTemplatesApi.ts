import { fetchJson } from "./httpClient";

export type DocumentTemplate = {
  id: number;
  name: string;
  trigger_type: string;
  match_value: string;
  google_drive_url: string;
  enabled: boolean | number;
  notes: string;
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
