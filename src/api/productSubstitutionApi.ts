import { fetchJson } from "./httpClient";

export type ProductSubstitutionRequest = {
  order_id: number;
  order_item_id: number;
  replacement_product_id: number;
  new_quantity: number;
};

export type ProductSubstitutionPreview = {
  order_id: number;
  order_item_id: number;
  old_sku: string;
  new_sku: string;
  old_quantity: number;
  new_quantity: number;
  line_total: string;
  line_tax: string;
  old_stock_before: number;
  old_stock_after: number;
  new_stock_before: number;
  new_stock_after: number;
  price_difference: string;
  currency: string;
  shipment_tracking: string;
  note: string;
  is_preview: boolean;
};

export function previewProductSubstitution(payload: ProductSubstitutionRequest): Promise<ProductSubstitutionPreview> {
  return fetchJson<ProductSubstitutionPreview>("/api/v1/packing/product-substitution/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function substituteProduct(payload: ProductSubstitutionRequest): Promise<ProductSubstitutionPreview & { packing_status?: string }> {
  return fetchJson("/api/v1/packing/product-substitution", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
