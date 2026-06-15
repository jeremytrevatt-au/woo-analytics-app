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

export async function getOverviewKpis(filter: AppFilterState): Promise<KpiCardData[]> {
  const params = new URLSearchParams({
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  const qs = `?${params.toString()}`;

  let compareQs = "";
  if (filter.compareEnabled && filter.compareStartDate && filter.compareEndDate) {
    const compParams = new URLSearchParams({
      start_date: filter.compareStartDate,
      end_date: filter.compareEndDate
    });
    compareQs = `?${compParams.toString()}`;
  }

  const [orders, customers, stock, compOrders, compCustomers, compStock] = await Promise.all([
    fetchJson<OrdersOverviewResponse>(`/api/v1/orders/overview${qs}`),
    fetchJson<CustomersOverviewResponse>(`/api/v1/customers/overview${qs}`),
    fetchJson<StockOverviewResponse>(`/api/v1/stock/overview${qs}`),
    compareQs ? fetchJson<OrdersOverviewResponse>(`/api/v1/orders/overview${compareQs}`) : Promise.resolve(null),
    compareQs ? fetchJson<CustomersOverviewResponse>(`/api/v1/customers/overview${compareQs}`) : Promise.resolve(null),
    compareQs ? fetchJson<StockOverviewResponse>(`/api/v1/stock/overview${compareQs}`) : Promise.resolve(null)
  ]);

  const calcDelta = (current: number, previous: number | null) => {
    if (previous === null || previous === 0) return { delta: "0.0%", positiveDelta: true };
    const pct = ((current - previous) / previous) * 100;
    return {
      delta: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
      positiveDelta: pct >= 0
    };
  };

  const ordersDelta = calcDelta(orders.total_orders ?? 0, compOrders?.total_orders ?? null);
  const revenueDelta = calcDelta(orders.total_revenue ?? 0, compOrders?.total_revenue ?? null);
  const customersDelta = calcDelta(customers.customer_count ?? 0, compCustomers?.customer_count ?? null);
  const stockDelta = calcDelta(stock.out_of_stock_skus ?? 0, compStock?.out_of_stock_skus ?? null);

  return [
    {
      id: "orders",
      label: "Orders",
      value: formatNumber(orders.total_orders ?? 0),
      delta: ordersDelta.delta,
      positiveDelta: ordersDelta.positiveDelta
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatCurrency(orders.total_revenue ?? 0),
      delta: revenueDelta.delta,
      positiveDelta: revenueDelta.positiveDelta
    },
    {
      id: "customers",
      label: "Customers",
      value: formatNumber(customers.customer_count ?? 0),
      delta: customersDelta.delta,
      positiveDelta: customersDelta.positiveDelta
    },
    {
      id: "stockAlerts",
      label: "Stock Alerts",
      value: formatNumber(stock.out_of_stock_skus ?? 0),
      delta: stockDelta.delta,
      positiveDelta: !stockDelta.positiveDelta // Less stock alerts is better
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
  if (filter.skuStartsWith) params.append("sku_starts_with", filter.skuStartsWith);
  if (filter.skuContains) params.append("sku_contains", filter.skuContains);
  if (filter.skuEndsWith) params.append("sku_ends_with", filter.skuEndsWith);
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
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: "all",
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
  const mappedStatus = filter.stockStatus.includes("instock") ? "instock" : filter.stockStatus.includes("outofstock") ? "outofstock" : "all";
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status: mappedStatus,
    q: filter.searchText,
    start_date: filter.startDate,
    end_date: filter.endDate
  });
  if (filter.category) params.append("category", filter.category);
  if (filter.skuStartsWith) params.append("sku_starts_with", filter.skuStartsWith);
  if (filter.skuContains) params.append("sku_contains", filter.skuContains);
  if (filter.skuEndsWith) params.append("sku_ends_with", filter.skuEndsWith);
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
  if (filter.skuStartsWith) params.append("sku_starts_with", filter.skuStartsWith);
  if (filter.skuContains) params.append("sku_contains", filter.skuContains);
  if (filter.skuEndsWith) params.append("sku_ends_with", filter.skuEndsWith);
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
  if (filter.skuStartsWith) params.append("sku_starts_with", filter.skuStartsWith);
  if (filter.skuContains) params.append("sku_contains", filter.skuContains);
  if (filter.skuEndsWith) params.append("sku_ends_with", filter.skuEndsWith);
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

export async function getCategories(): Promise<string[]> {
  const response = await fetchJson<{ categories: string[] }>("/api/v1/categories");
  return response.categories;
}

export async function getStockForecast(
  leadTimeDays: number,
  page: number,
  pageSize: number,
  q: string,
  method: string = "sma",
  lookbackDays: number = 365,
  category: string | null = null,
  skuStartsWith: string | null = null,
  skuContains: string | null = null,
  skuEndsWith: string | null = null
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
  if (skuStartsWith) params.append("sku_starts_with", skuStartsWith);
  if (skuContains) params.append("sku_contains", skuContains);
  if (skuEndsWith) params.append("sku_ends_with", skuEndsWith);
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

export function buildForecastFromTrends(trends: TrendPoint[], granularity: string = "day"): ForecastPoint[] {
  if (trends.length === 0) return [];
  
  // Use the entire actual plot
  const actualPoints = trends.map((point) => ({
    month: point.label,
    actual: point.revenue,
    predicted: null as number | null,
    compareActual: point.compareRevenue ?? null,
    comparePredicted: null as number | null
  }));

  if (actualPoints.length === 0) return [];

  // Connect the forecast line to the last actual point
  const lastActual = actualPoints[actualPoints.length - 1];
  lastActual.predicted = lastActual.actual;
  if (lastActual.compareActual !== null) {
    lastActual.comparePredicted = lastActual.compareActual;
  }

  // Linear regression for actual revenue
  let m = 0;
  let b = 0;
  const n = actualPoints.length;
  if (n > 1) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += actualPoints[i].actual;
      sumXY += i * actualPoints[i].actual;
      sumX2 += i * i;
    }
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator !== 0) {
      m = (n * sumXY - sumX * sumY) / denominator;
      b = (sumY - m * sumX) / n;
    }
  } else if (n === 1) {
    b = actualPoints[0].actual;
  }

  // Linear regression for compare revenue
  let mComp = 0;
  let bComp = 0;
  let hasCompare = false;
  if (n > 1 && actualPoints[0].compareActual !== null) {
    hasCompare = true;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const val = actualPoints[i].compareActual || 0;
      sumX += i;
      sumY += val;
      sumXY += i * val;
      sumX2 += i * i;
    }
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator !== 0) {
      mComp = (n * sumXY - sumX * sumY) / denominator;
      bComp = (sumY - mComp * sumX) / n;
    }
  }

  const forecastPoints: ForecastPoint[] = [...actualPoints];
  
  // Generate 3 future points
  let lastDate = new Date(lastActual.month);
  const isValidDate = !isNaN(lastDate.getTime());

  for (let i = 1; i <= 3; i++) {
    if (isValidDate) {
      if (granularity === "day") {
        lastDate.setDate(lastDate.getDate() + 1);
      } else if (granularity === "week") {
        lastDate.setDate(lastDate.getDate() + 7);
      } else if (granularity === "month") {
        lastDate.setMonth(lastDate.getMonth() + 1);
      } else if (granularity === "quarter") {
        lastDate.setMonth(lastDate.getMonth() + 3);
      } else if (granularity === "year") {
        lastDate.setFullYear(lastDate.getFullYear() + 1);
      }
    }
    
    const nextLabel = isValidDate 
      ? lastDate.toISOString().split("T")[0] 
      : `${lastActual.month} +${i}`;

    let nextVal = m * (n - 1 + i) + b;
    if (nextVal < 0) nextVal = 0; // clamp to 0

    let nextCompVal = null;
    if (hasCompare) {
      nextCompVal = mComp * (n - 1 + i) + bComp;
      if (nextCompVal < 0) nextCompVal = 0;
    }

    forecastPoints.push({
      month: nextLabel,
      actual: null,
      predicted: Number(nextVal.toFixed(2)),
      compareActual: null,
      comparePredicted: nextCompVal !== null ? Number(nextCompVal.toFixed(2)) : null
    });
  }

  return forecastPoints;
}

export async function getStockShortages(
  filter: AppFilterState,
  page: number,
  pageSize: number
): Promise<PaginatedRecords> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    q: filter.searchText,
  });
  if (filter.category) params.append("category", filter.category);
  if (filter.skuStartsWith) params.append("sku_starts_with", filter.skuStartsWith);
  if (filter.skuContains) params.append("sku_contains", filter.skuContains);
  if (filter.skuEndsWith) params.append("sku_ends_with", filter.skuEndsWith);

  const response = await fetchJson<PaginatedResponse<any>>(`/api/v1/stock/shortages?${params.toString()}`);
  return {
    records: response.records,
    columns: response.columns || [],
    page: response.page,
    pageSize: response.page_size,
    totalCount: response.total_count
  };
}
