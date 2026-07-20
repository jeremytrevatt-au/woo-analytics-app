export type StockLedgerEntry = {
  id: number;
  timestamp: string;
  product_id: number;
  variation_id: number;
  wsvi_group_id: string;
  change_amount: number;
  new_stock_level: number;
  reason: string;
  reference_id: number;
  user_id: number;
  product_name: string;
  sku: string;
};

export interface StockLedgerResponse {
  items: StockLedgerEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type AppFilterState = {
  dateRange: "custom" | "today" | "this_week" | "last_week" | "mtd" | "last_month" | "qtd" | "ytd" | "last_year" | "last_3_months" | "last_6_months" | "all_time";
  compareEnabled: boolean;
  granularity: "day" | "week" | "month" | "quarter" | "year";
  startDate: string;
  endDate: string;
  compareStartDate: string | null;
  compareEndDate: string | null;
  orderStatus: string[];
  stockStatus: string[];
  searchText: string;
  category: string;
  skuStartsWith: string;
  skuContains: string;
  skuEndsWith: string;
  sortBy: string | null;
  sortDir: "asc" | "desc";
};

export type KpiCardData = {
  id: string;
  label: string;
  value: string;
  delta: string;
  positiveDelta: boolean;
};

export type TrendPoint = {
  label: string;
  orders: number;
  revenue: number;
  customers: number;
  stock: number;
  compareOrders?: number;
  compareRevenue?: number;
  compareCustomers?: number;
  compareStock?: number;
};

export type ForecastPoint = {
  month: string;
  actual: number | null;
  predicted: number | null;
  compareActual?: number | null;
  comparePredicted?: number | null;
};

export type TableColumn = {
  key: string;
  label: string;
  type: "string" | "number" | "currency" | "date" | "boolean" | "node";
};

export type DynamicTableRecord = Record<string, unknown>;

export type PaginatedRecords = {
  records: DynamicTableRecord[];
  columns: TableColumn[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type StockForecastVariant = {
  product_id: number;
  parent_id: number | null;
  sku: string;
  product_name: string;
  current_stock_qty: number;
  avg_daily_usage: number;
  days_of_cover: number | null;
  projected_stockout_date: string | null;
  reorder_within_lead_time: boolean;
  lead_time_days: number;
  nya_stock_eta: string | null;
  nya_stock_reorder_qty: number | null;
  nya_default_lead_time: number | null;
  canonical_product_key?: string | null;
  forecast_source?: string;
  movement_avg_daily_usage?: number;
  snapshot_avg_daily_usage?: number;
  historical_order_line_usage_qty?: number;
  historical_order_line_count?: number;
};

export type StockForecastRecord = {
  base_sku: string;
  category: string;
  product_name: string;
  any_reorder: boolean;
  min_days_of_cover: number | null;
  forecast_sources?: string[];
  historical_order_line_usage_qty?: number;
  historical_order_line_count?: number;
  variants: StockForecastVariant[];
};

export type StockForecastHistoryPoint = {
  movement_date: string;
  canonical_product_key: string;
  sku: string;
  product_name: string;
  forecast_usage_qty: number;
  excluded_qty: number;
  included_lines: number;
  excluded_lines: number;
  sample_lines: Array<Record<string, unknown>>;
};

export type StockForecastHistoryResponse = {
  canonical_product_key: string | null;
  sku: string | null;
  lookback_days: number;
  points: StockForecastHistoryPoint[];
};

export type ApiDebugEvent = {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  requestBody?: unknown;
  statusCode?: number;
  durationMs?: number;
  responseBody?: unknown;
  error?: string;
};
