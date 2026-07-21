import { fetchJson } from "./httpClient";

export async function triggerDataSync(): Promise<{ status: string; message: string; operation: string }> {
  return fetchJson<{ status: string; message: string; operation: string }>("/api/v1/admin/sync", {
    method: "POST",
  });
}

export async function purgeStockLedger(): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>("/api/v1/admin/purge-ledger", {
    method: "POST",
  });
}

export type StockBackfillDiagnostics = {
  order_line_summary?: Array<Record<string, unknown>>;
  sku_identity_summary?: Array<Record<string, unknown>>;
  ledger_overlap_summary?: Array<Record<string, unknown>>;
  identity_bridge_summary?: Array<Record<string, unknown>>;
  derived_movement_summary?: Array<Record<string, unknown>>;
  latest_runs?: Array<Record<string, unknown>>;
};

export type StockBackfillRunResponse = {
  run_id: string;
  status: string;
  dry_run: boolean;
  identity_rows?: number;
  derived_rows?: number;
  included_rows?: number;
  low_confidence_rows?: number;
  excluded_rows?: number;
  identity_preview?: {
    records: Array<Record<string, unknown>>;
    count: number;
  };
  diagnostics?: StockBackfillDiagnostics;
};

export type StockIdentityReviewRow = {
  canonical_product_key: string;
  product_id: number;
  parent_id: number | null;
  sku: string | null;
  normalized_sku: string;
  product_name: string | null;
  category: string | null;
  wsvi_group_id: string | null;
  first_seen_date: string | null;
  last_seen_date: string | null;
  latest_snapshot_date: string | null;
  source_count: number;
  confidence: number;
  confidence_reason: string;
  review_status: string;
  approved_for_forecast: boolean;
  generated_at: string;
};

export type StockIdentityReviewResponse = {
  records: StockIdentityReviewRow[];
  page: number;
  page_size: number;
  total_count: number;
};

export type StockIdentityReviewAction = "approve" | "exclude" | "remap_product";

export async function getStockBackfillDiagnostics(): Promise<StockBackfillDiagnostics> {
  return fetchJson<StockBackfillDiagnostics>("/api/v1/admin/stock-backfill/diagnostics");
}

export async function runStockBackfill(dryRun: boolean): Promise<StockBackfillRunResponse> {
  return fetchJson<StockBackfillRunResponse>(`/api/v1/admin/stock-backfill/run?dry_run=${dryRun ? "true" : "false"}`, {
    method: "POST",
  });
}

export async function getStockIdentityReviewRows(
  reviewStatus: string = "review_required",
  page: number = 1,
  pageSize: number = 50
): Promise<StockIdentityReviewResponse> {
  const params = new URLSearchParams({
    review_status: reviewStatus,
    page: String(page),
    page_size: String(pageSize),
  });
  return fetchJson<StockIdentityReviewResponse>(`/api/v1/admin/stock-backfill/identity-review?${params.toString()}`);
}

export async function updateStockIdentityReviewRow(
  productId: number,
  normalizedSku: string,
  action: StockIdentityReviewAction,
  canonicalProductKey?: string,
  targetProductId?: number,
  targetWsviGroupId?: string
): Promise<{ status: string; movement_metrics: Record<string, number> }> {
  return fetchJson<{ status: string; movement_metrics: Record<string, number> }>("/api/v1/admin/stock-backfill/identity-review", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      normalized_sku: normalizedSku,
      action,
      canonical_product_key: canonicalProductKey,
      target_product_id: targetProductId,
      target_wsvi_group_id: targetWsviGroupId,
    }),
  });
}
