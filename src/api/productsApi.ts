import { fetchJson } from "./httpClient";

export type ProductSearchResult = {
  id: number;
  parent_id?: number;
  edit_product_id?: number;
  name: string;
  sku: string;
  type: string;
  wsvi_group_id?: string;
};

let productIndexPromise: Promise<ProductSearchResult[]> | null = null;

export const productsApi = {
  async search(query: string): Promise<ProductSearchResult[]> {
    if (!query || query.length < 2) return [];
    const params = new URLSearchParams({ q: query });
    return fetchJson<ProductSearchResult[]>(`/api/v1/products/search?${params.toString()}`);
  },

  async getIndex(): Promise<ProductSearchResult[]> {
    if (!productIndexPromise) {
      productIndexPromise = fetchJson<ProductSearchResult[]>("/api/v1/products/index")
        .catch((error) => {
          productIndexPromise = null;
          throw error;
        });
    }
    return productIndexPromise;
  }
};
