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

export async function getStockBackfillDiagnostics(): Promise<StockBackfillDiagnostics> {
  return fetchJson<StockBackfillDiagnostics>("/api/v1/admin/stock-backfill/diagnostics");
}

export async function runStockBackfill(dryRun: boolean): Promise<StockBackfillRunResponse> {
  return fetchJson<StockBackfillRunResponse>(`/api/v1/admin/stock-backfill/run?dry_run=${dryRun ? "true" : "false"}`, {
    method: "POST",
  });
}
