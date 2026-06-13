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
};

type StockForecastRow = {
  product_id: number;
  sku: string | null;
  current_stock_qty: number;
  avg_daily_usage: number;
  days_of_cover: number | null;
  projected_stockout_date: string | null;
  reorder_within_lead_time: boolean;
};

type PaginatedResponse<T> = {
  records: T[];
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

export async function getOrderRecords(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: filter.orderStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<PaginatedResponse<OrdersRow>>(`/api/v1/orders?${params.toString()}`);
  return {
    records: response.records.map((row) => ({
      id: `${row.order_date}-${row.order_status}`,
      name: row.order_date,
      status: row.order_status,
      metricA: row.order_count,
      metricB: row.order_revenue,
      meta: "Order day/status aggregate"
    })),
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
    filter.orderStatus === "active" || filter.orderStatus === "inactive" ? filter.orderStatus : "all";
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: mappedStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<PaginatedResponse<CustomersRow>>(`/api/v1/customers?${params.toString()}`);
  return {
    records: response.records.map((row) => ({
      id: String(row.customer_id),
      name: `Customer #${row.customer_id}`,
      status: row.is_active_customer ? "active" : "inactive",
      metricA: row.order_count,
      metricB: row.lifetime_value,
      meta: row.last_order_date ? `Last order ${row.last_order_date}` : "No order date"
    })),
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
  const mappedStatus = filter.orderStatus === "instock" ? "instock" : filter.orderStatus === "outofstock" ? "outofstock" : "all";
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: mappedStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<PaginatedResponse<StockRow>>(`/api/v1/stock?${params.toString()}`);
  return {
    records: response.records.map((row) => ({
      id: `${row.snapshot_date}-${row.product_id}`,
      name: row.sku || `Product ${row.product_id}`,
      status: row.stock_status,
      metricA: row.stock_qty,
      metricB: 0,
      meta: `${row.product_type} | snapshot ${row.snapshot_date}`
    })),
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}

export async function getOrderTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    status: filter.orderStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<TrendResponse>(`/api/v1/orders/trend?${params.toString()}`);
  return response.points.map((point) => ({
    label: point.bucket_date,
    orders: point.order_count ?? 0,
    revenue: point.order_revenue ?? 0,
    customers: 0,
    stock: 0
  }));
}

export async function getCustomerTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<TrendResponse>(`/api/v1/customers/trend?${params.toString()}`);
  return response.points.map((point) => ({
    label: point.bucket_date,
    orders: 0,
    revenue: 0,
    customers: point.customer_count ?? 0,
    stock: point.active_customer_count ?? 0
  }));
}

export async function getStockTrends(filter: AppFilterState): Promise<TrendPoint[]> {
  const params = new URLSearchParams({
    granularity: filter.granularity,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const response = await fetchJson<TrendResponse>(`/api/v1/stock/trend?${params.toString()}`);
  return response.points.map((point) => ({
    label: point.bucket_date,
    orders: 0,
    revenue: 0,
    customers: point.tracked_skus ?? 0,
    stock: point.out_of_stock_skus ?? 0
  }));
}

export async function getStockForecast(
  leadTimeDays: number,
  page: number,
  pageSize: number,
  q: string
): Promise<{ records: StockForecastRecord[]; totalCount: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    lead_time_days: String(leadTimeDays),
    page: String(page),
    page_size: String(pageSize),
    q
  });
  const response = await fetchJson<PaginatedResponse<StockForecastRow>>(`/api/v1/stock/forecast?${params.toString()}`);
  return {
    records: response.records.map((row) => ({
      productId: row.product_id,
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
