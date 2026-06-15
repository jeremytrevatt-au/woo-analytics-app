import {
  AppFilterState,
  ForecastPoint,
  KpiCardData,
  PaginatedRecords,
  StockForecastRecord,
  TableRecord,
  TrendPoint
} from "../types/analytics";
import { formatCurrency, formatNumber, summarizeDelta } from "../lib/format";
import { fetchJson } from "./httpClient";

type OrdersOverviewResponse = {
  total_orders: number;
  total_revenue: number;
};

type CustomersOverviewResponse = {
  customer_count: number;
};

type StockOverviewResponse = {
  out_of_stock_skus: number;
};

type TrendResponse = {
  points: Array<{
    bucket_date: string;
    order_count?: number;
    order_revenue?: number;
    customer_count?: number;
    active_customer_count?: number;
    tracked_skus?: number;
    out_of_stock_skus?: number;
  }>;
  compare_points?: Array<{
    bucket_date: string;
    order_count?: number;
    order_revenue?: number;
    customer_count?: number;
    active_customer_count?: number;
    tracked_skus?: number;
    out_of_stock_skus?: number;
  }>;
};

type StockForecastRow = {
  product_id: number;
  parent_id?: number | null;
  sku: string | null;
  current_stock_qty: number;
  avg_daily_usage: number;
  days_of_cover: number | null;
  projected_stockout_date: string | null;
  reorder_within_lead_time: boolean;
};

type PaginatedResponse<T> = {
  records: T[];
  columns?: Array<{ key: string; label: string; type: "string" | "number" | "currency" | "date" | "boolean" }>;
  page: number;
  page_size: number;
  total_count: number;
};

type OrdersRow = {
  order_date: string;
  order_status: string;
  order_count: number;
  order_revenue: number;
};

type CustomersRow = {
  customer_id: number;
  order_count: number;
  lifetime_value: number;
  last_order_date: string | null;
  is_active_customer: boolean;
};

type StockRow = {
  snapshot_date: string;
  product_id: number;
  product_type: string;
  sku: string;
  stock_qty: number;
  stock_status: string;
};

export async function getOverviewKpis(_filter: AppFilterState): Promise<KpiCardData[]> {
  const [orders, customers, stock] = await Promise.all([
    fetchJson<OrdersOverviewResponse>("/api/v1/orders/overview"),
    fetchJson<CustomersOverviewResponse>("/api/v1/customers/overview"),
    fetchJson<StockOverviewResponse>("/api/v1/stock/overview")
  ]);

  return [
    {
      id: "orders",
      label: "Orders",
      value: formatNumber(orders.total_orders ?? 0),
      delta: summarizeDelta(0),
      positiveDelta: true
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatCurrency(orders.total_revenue ?? 0),
      delta: summarizeDelta(0),
      positiveDelta: true
    },
    {
      id: "customers",
      label: "Customers",
      value: formatNumber(customers.customer_count ?? 0),
      delta: summarizeDelta(0),
      positiveDelta: true
    },
    {
      id: "stockAlerts",
      label: "Stock Alerts",
      value: formatNumber(stock.out_of_stock_skus ?? 0),
      delta: summarizeDelta(0),
      positiveDelta: false
    }
  ];
}

export async function getBackorderRecords(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.orderStatus.length > 0) {
    params.append("order_status", filter.orderStatus.join(","));
  }
  if (filter.stockStatus.length > 0) {
    params.append("stock_status", filter.stockStatus.join(","));
  }
  if (filter.sortBy) {
    params.append("sort_by", filter.sortBy);
    params.append("sort_dir", filter.sortDir);
  }
  const response = await fetchJson<PaginatedResponse<any>>(`/api/v1/backorders?${params.toString()}`);
  return {
    records: response.records,
    columns: response.columns || [],
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}

export async function getOrderRecords(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.orderStatus.length > 0) {
    params.append("status", filter.orderStatus.join(","));
  }
  if (filter.category) params.append("category", filter.category);
  if (filter.skuPattern) {
    params.append("sku_pattern", filter.skuPattern);
    params.append("sku_pattern_type", filter.skuPatternType);
  }
  if (filter.sortBy) {
    params.append("sort_by", filter.sortBy);
    params.append("sort_dir", filter.sortDir);
  }
  const response = await fetchJson<PaginatedResponse<any>>(`/api/v1/orders?${params.toString()}`);
  return {
    records: response.records,
    columns: response.columns || [],
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}

export async function getCustomerRecords(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const mappedStatus =
    filter.orderStatus.includes("active") ? "active" : filter.orderStatus.includes("inactive") ? "inactive" : "all";
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: mappedStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.sortBy) {
    params.append("sort_by", filter.sortBy);
    params.append("sort_dir", filter.sortDir);
  }
  const response = await fetchJson<PaginatedResponse<any>>(`/api/v1/customers?${params.toString()}`);
  return {
    records: response.records,
    columns: response.columns || [],
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}

export async function getStockRecords(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const mappedStatus = filter.orderStatus.includes("instock") ? "instock" : filter.orderStatus.includes("outofstock") ? "outofstock" : "all";
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: mappedStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.category) params.append("category", filter.category);
  if (filter.skuPattern) {
    params.append("sku_pattern", filter.skuPattern);
    params.append("sku_pattern_type", filter.skuPatternType);
  }
  if (filter.sortBy) {
    params.append("sort_by", filter.sortBy);
    params.append("sort_dir", filter.sortDir);
  }
  const response = await fetchJson<PaginatedResponse<any>>(`/api/v1/stock?${params.toString()}`);
  return {
    records: response.records,
    columns: response.columns || [],
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}

export async function getOrderTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.orderStatus.length > 0) {
    params.append("status", filter.orderStatus.join(","));
  }
  if (filter.compareEnabled && filter.compareStartDate && filter.compareEndDate) {
    params.append("compare_start_date", filter.compareStartDate);
    params.append("compare_end_date", filter.compareEndDate);
  }
  if (filter.category) params.append("category", filter.category);
  if (filter.skuPattern) {
    params.append("sku_pattern", filter.skuPattern);
    params.append("sku_pattern_type", filter.skuPatternType);
  }
  const response = await fetchJson<TrendResponse>(`/api/v1/orders/trend?${params.toString()}`);

  return response.points.map((point, index) => {
    const compare = response.compare_points?.[index];
    return {
      label: point.bucket_date,
      orders: point.order_count ?? 0,
      revenue: point.order_revenue ?? 0,
      customers: 0,
      stock: 0,
      compareOrders: compare?.order_count ?? 0,
      compareRevenue: compare?.order_revenue ?? 0
    };
  });
}

export async function getCustomerTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.compareEnabled && filter.compareStartDate && filter.compareEndDate) {
    params.append("compare_start_date", filter.compareStartDate);
    params.append("compare_end_date", filter.compareEndDate);
  }
  const response = await fetchJson<TrendResponse>(`/api/v1/customers/trend?${params.toString()}`);

  return response.points.map((point, index) => {
    const compare = response.compare_points?.[index];
    return {
      label: point.bucket_date,
      orders: 0,
      revenue: 0,
      customers: point.customer_count ?? 0,
      stock: point.active_customer_count ?? 0,
      compareCustomers: compare?.customer_count ?? 0,
      compareStock: compare?.active_customer_count ?? 0
    };
  });
}

export async function getStockTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.compareEnabled && filter.compareStartDate && filter.compareEndDate) {
    params.append("compare_start_date", filter.compareStartDate);
    params.append("compare_end_date", filter.compareEndDate);
  }
  if (filter.category) params.append("category", filter.category);
  if (filter.skuPattern) {
    params.append("sku_pattern", filter.skuPattern);
    params.append("sku_pattern_type", filter.skuPatternType);
  }
  const response = await fetchJson<TrendResponse>(`/api/v1/stock/trend?${params.toString()}`);

  return response.points.map((point, index) => {
    const compare = response.compare_points?.[index];
    return {
      label: point.bucket_date,
      orders: 0,
      revenue: 0,
      customers: point.tracked_skus ?? 0, // We use 'customers' to hold total stock units in the chart
      stock: point.out_of_stock_skus ?? 0,
      compareCustomers: compare?.tracked_skus ?? 0,
      compareStock: compare?.out_of_stock_skus ?? 0
    };
  });
}

export async function getStockForecast(
  leadTimeDays: number,
  page: number,
  pageSize: number,
  q: string,
  method: string = "sma",
  lookbackDays: number = 365,
  category: string | null = null,
  skuPattern: string | null = null,
  skuPatternType: string = "contains"
): Promise<{ records: StockForecastRecord[]; totalCount: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    lead_time_days: String(leadTimeDays),
    page: String(page),
    page_size: String(pageSize),
    q,
    method,
    lookback_days: String(lookbackDays)
  });
  if (category) params.append("category", category);
  if (skuPattern) {
    params.append("sku_pattern", skuPattern);
    params.append("sku_pattern_type", skuPatternType);
  }
  const response = await fetchJson<PaginatedResponse<StockForecastRow>>(`/api/v1/stock/forecast?${params.toString()}`);
  return {
    records: response.records.map((row) => ({
      productId: row.parent_id || row.product_id,
      sku: row.sku ?? "",
      currentStockQty: row.current_stock_qty,
      avgDailyUsage: row.avg_daily_usage,
      daysOfCover: row.days_of_cover,
      projectedStockoutDate: row.projected_stockout_date,
      reorderWithinLeadTime: row.reorder_within_lead_time
    })),
    totalCount: response.total_count,
    page: response.page,
    pageSize: response.page_size
  };
}

export function buildForecastFromTrends(trends: TrendPoint[]): ForecastPoint[] {
  return trends.slice(-6).map((point) => ({
    month: point.label,
    actual: point.revenue,
    predicted: Math.round(point.revenue * 1.08)
  }));
}
