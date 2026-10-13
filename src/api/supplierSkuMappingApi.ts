import { fetchJson } from "./httpClient";

export type SkuMappingStatus =
  | "match"
  | "unchanged"
  | "conflict"
  | "blocked"
  | "unmapped"
  | "no_woo_product"
  | "ambiguous"
  | "price_tbd"
  | "sheet_warning"
  | "woo_disabled";

export type SkuMappingAttribute = {
  /** The WooCommerce attribute label as the plugin reports it (e.g. "Tier"). */
  name: string;
  /** The term name (never the slug). Blank means the variation's attribute is set to "Any". */
  term_name: string;
};

export type SkuMappingCandidate = {
  id: number;
  type: "simple" | "variation";
  sku: string;
  status: string;
  parent_id: number;
  parent_name: string;
  /** Product name: the parent product's name for a variation, the product's own name for a simple product. */
  name: string;
  /** Variation attributes with term names; empty for a simple product. */
  attributes: SkuMappingAttribute[];
  label: string;
  supplier_id: number | null;
  supplier_sku: string;
  supplier_price: string;
};

export type SkuMappingRowWarning = { code: string; message: string };

export type SkuMappingPreviewRow = {
  row_id: number;
  page: number;
  supplier_name: string;
  supplier_sku: string;
  price: string | null;
  price_flag: string;
  case_qty: number | null;
  family: string;
  tier: number | null;
  style: string | null;
  colour: string | null;
  colour_as_sheet: string | null;
  height: string | null;
  aliases_applied: string[];
  flags: string[];
  notes: string[];
  warnings: SkuMappingRowWarning[];
  matched: SkuMappingCandidate | null;
  candidates: SkuMappingCandidate[];
  is_suggestion: boolean;
  include_default: boolean;
  base_status: SkuMappingStatus;
  status: SkuMappingStatus;
};

export type SkuMappingFamilyResolution = {
  family: string;
  label: string;
  resolved: boolean;
  problem: string | null;
  parent_id: number | null;
  parent_name: string | null;
  parent_sku: string | null;
  variation_count: number;
};

export type SkuMappingAlias = {
  supplier_value: string;
  woo_value: string;
  applies_to: string;
};

export type SkuMappingReferenceDiff = {
  reference_label: string;
  sheet_row_count: number;
  pdf_row_count: number;
  skus_only_on_sheet: string[];
  skus_only_in_pdf: string[];
  colour_headers_only_on_sheet: string[];
  colour_headers_only_in_pdf: string[];
};

export type SkuMappingPreview = {
  run_id?: string;
  supplier: { id: number; name: string; default_currency: string };
  reference_diff?: SkuMappingReferenceDiff;
  parse: {
    stats: Record<string, number>;
    colour_headers: string[];
  };
  totals: Record<string, number>;
  row_count: number;
  rows: SkuMappingPreviewRow[];
  family_resolution: SkuMappingFamilyResolution[];
  aliases: SkuMappingAlias[];
  candidates: SkuMappingCandidate[];
  woo_without_supplier_row: SkuMappingCandidate[];
  plugin_version?: string;
};

export type SkuMappingCommitRow = {
  product_id: number;
  supplier_id: number;
  supplier_sku: string;
  supplier_price: string;
  replace: boolean;
};

export type SkuMappingSupplierValues = {
  supplier_id: number | null;
  supplier_sku: string;
  supplier_price: string;
};

export type SkuMappingCommitResult = {
  index: number;
  product_id: number;
  status: "updated" | "unchanged" | "conflict_skipped" | "error";
  code?: string;
  message?: string;
  before?: SkuMappingSupplierValues;
  after?: SkuMappingSupplierValues;
};

export type SkuMappingCommitResponse = {
  success: boolean;
  counts: { updated: number; unchanged: number; conflict_skipped: number; error: number };
  results: SkuMappingCommitResult[];
};

export type SupplierSkuLookupItem = {
  product_id: number;
  supplier_id: number;
  supplier_sku: string;
  supplier_price: string;
};

export type SupplierSkuLookupResponse = {
  supplier_id?: number;
  default_currency?: string | null;
  items: SupplierSkuLookupItem[];
};

export const supplierSkuMappingApi = {
  /** Read-only: reads the supplier's stored Google Sheet and matches it. Nothing is written. */
  async preview(supplierId: number): Promise<SkuMappingPreview> {
    return fetchJson<SkuMappingPreview>("/api/v1/supplier-sku-mapping/preview", {
      method: "POST",
      body: JSON.stringify({ supplier_id: supplierId }),
    });
  },

  async commit(rows: SkuMappingCommitRow[]): Promise<SkuMappingCommitResponse> {
    return fetchJson<SkuMappingCommitResponse>("/api/v1/supplier-sku-mapping/commit", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  },

  async lookup(supplierId: number, productIds: number[]): Promise<SupplierSkuLookupResponse> {
    return fetchJson<SupplierSkuLookupResponse>("/api/v1/supplier-sku-mapping/lookup", {
      method: "POST",
      body: JSON.stringify({ supplier_id: supplierId, product_ids: productIds }),
    });
  },
};
