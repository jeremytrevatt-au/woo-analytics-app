import { fetchJson } from "./httpClient";

export type ProductSearchResult = {
  id: number;
  name: string;
  sku: string;
  type: string;
  wsvi_group_id?: string;
  wsvi_group_name?: string;
};

export const productsApi = {
  async search(query: string): Promise<ProductSearchResult[]> {
    if (!query || query.length < 2) return [];
    const params = new URLSearchParams({ q: query });
    return fetchJson<ProductSearchResult[]>(`/api/v1/products/search?${params.toString()}`);
  }
};
