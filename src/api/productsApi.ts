import { fetchJson } from "./httpClient";

export type ProductSearchResult = {
  id: number;
  parent_id?: number;
  edit_product_id?: number;
  name: string;
  sku: string;
  type: string;
  wsvi_group_id?: string;
  stock_qty?: number | null;
  stock_target_type?: string | null;
  stock_snapshot_date?: string | null;
  days_of_cover?: number | null;
  reorder_within_lead_time?: boolean | null;
  avg_daily_usage?: number | null;
  forecast_source?: string | null;
  forecast_window_days?: number | null;
  effective_lead_time_days?: number | null;
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
