export type AppFilterState = {
  dateRange: "custom";
  granularity: "day" | "week" | "month" | "quarter" | "year";
  startDate: string;
  endDate: string;
  orderStatus: "all" | "processing" | "completed" | "on-hold" | "active" | "inactive" | "instock" | "outofstock";
  searchText: string;
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
};

export type TableRecord = {
  id: string;
  name: string;
  status: string;
  metricA: number;
  metricB: number;
  meta?: string;
};

export type ForecastPoint = {
  month: string;
  actual: number;
  predicted: number;
};

export type PaginatedRecords = {
  records: TableRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type StockForecastRecord = {
  productId: number;
  sku: string;
  currentStockQty: number;
  avgDailyUsage: number;
  daysOfCover: number | null;
  projectedStockoutDate: string | null;
  reorderWithinLeadTime: boolean;
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
