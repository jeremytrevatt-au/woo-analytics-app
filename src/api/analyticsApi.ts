import { AppFilterState, ForecastPoint, KpiCardData, PaginatedRecords, TableRecord, TrendPoint } from "../types/analytics";
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

export async function getOverviewKpis(filter: AppFilterState): Promise<KpiCardData[]> {
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
  const rangeDays = filter.dateRange === "7d" ? 7 : filter.dateRange === "30d" ? 30 : 90;
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: filter.orderStatus,
    q: filter.searchText,
    date_range_days: String(rangeDays)
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
    q: filter.searchText
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
    q: filter.searchText
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

export function buildOverviewTrends(rows: TableRecord[]): TrendPoint[] {
  return rows.slice(0, 12).map((row, index) => ({
    label: String(index + 1),
    orders: row.metricA,
    revenue: row.metricB,
    customers: 0,
    stock: 0
  }));
}

export function buildForecastFromRows(rows: TableRecord[]): ForecastPoint[] {
  const base = rows.slice(0, 5);
  return base.map((row, index) => ({
    month: `M${index + 1}`,
    actual: row.metricB,
    predicted: Math.round(row.metricB * 1.08)
  }));
}
