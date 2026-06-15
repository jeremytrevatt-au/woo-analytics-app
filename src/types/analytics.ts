export type AppFilterState = {
  dateRange: "custom" | "mtd" | "qtd" | "ytd";
  compareEnabled: boolean;
  granularity: "day" | "week" | "month" | "quarter" | "year";
  startDate: string;
  endDate: string;
  compareStartDate: string | null;
  compareEndDate: string | null;
  orderStatus: "all" | "processing" | "completed" | "on-hold" | "active" | "inactive" | "instock" | "outofstock";
  searchText: string;
  category: string;
  skuPattern: string;
  skuPatternType: "starts_with" | "ends_with" | "contains";
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

export type TableColumn = {
  key: string;
  label: string;
  type: "string" | "number" | "currency" | "date" | "boolean";
};

export type DynamicTableRecord = Record<string, unknown>;

export type PaginatedRecords = {
  records: DynamicTableRecord[];
  columns: TableColumn[];
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
