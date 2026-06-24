import { fetchJson } from "./httpClient";

export type Supplier = {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  default_currency: string;
  default_lead_time_days: number;
  created_at?: string;
};

export const suppliersApi = {
  async getAll(): Promise<Supplier[]> {
    return fetchJson<Supplier[]>("/api/v1/suppliers");
  },

  async getById(id: number): Promise<Supplier> {
    return fetchJson<Supplier>(`/api/v1/suppliers/${id}`);
  },

  async create(supplier: Partial<Supplier>): Promise<Supplier> {
    return fetchJson<Supplier>("/api/v1/suppliers", {
      method: "POST",
      body: JSON.stringify(supplier)
    });
  },

  async update(id: number, supplier: Partial<Supplier>): Promise<Supplier> {
    return fetchJson<Supplier>(`/api/v1/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(supplier)
    });
  },

  async delete(id: number): Promise<{ deleted: boolean }> {
    return fetchJson<{ deleted: boolean }>(`/api/v1/suppliers/${id}`, {
      method: "DELETE"
    });
  }
};
