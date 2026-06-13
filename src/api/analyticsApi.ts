import { AppFilterState, ForecastPoint, KpiCardData, TableRecord, TrendPoint } from "../types/analytics";
import { formatCurrency, formatNumber, summarizeDelta } from "../lib/format";

type DashboardPayload = {
  kpis: KpiCardData[];
  trends: TrendPoint[];
  rows: TableRecord[];
  forecast: ForecastPoint[];
};

type ServiceOverview = {
  dimension: string;
  status: string;
  total_orders?: number;
  total_revenue?: number;
  customer_count?: number;
  out_of_stock_skus?: number;
};

const apiBaseUrl = (import.meta.env.VITE_ANALYTICS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

async function fetchOverview(path: string): Promise<ServiceOverview | null> {
  if (!apiBaseUrl) {
    return null;
  }
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/${path}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ServiceOverview;
  } catch {
    return null;
  }
}

function seededScale(filter: AppFilterState): number {
  const dateFactor = filter.dateRange === "7d" ? 0.35 : filter.dateRange === "30d" ? 1 : 2.3;
  const statusFactor = filter.orderStatus === "all" ? 1 : 0.62;
  const searchFactor = filter.searchText.trim().length > 0 ? 0.75 : 1;
  return dateFactor * statusFactor * searchFactor;
}

export async function getDashboardPayload(filter: AppFilterState): Promise<DashboardPayload> {
  const [ordersOverview, customersOverview, stockOverview] = await Promise.all([
    fetchOverview("orders/overview"),
    fetchOverview("customers/overview"),
    fetchOverview("stock/overview")
  ]);

  const scale = seededScale(filter);
  const orders = Math.round((ordersOverview?.total_orders ?? 1240) * scale);
  const revenue = Math.round((ordersOverview?.total_revenue ?? 262000) * scale);
  const customers = Math.round((customersOverview?.customer_count ?? 470) * scale);
  const stockAlerts = Math.max(2, Math.round((stockOverview?.out_of_stock_skus ?? 46) * scale));

  const trends = Array.from({ length: 10 }).map((_, index) => ({
    label: `T${index + 1}`,
    orders: Math.round((80 + index * 7) * scale),
    revenue: Math.round((16000 + index * 1300) * scale),
    customers: Math.round((30 + index * 3) * scale),
    stock: Math.max(0, Math.round((10 + index * 1.7) * scale))
  }));

  const rows: TableRecord[] = [
    {
      id: "1",
      name: "Organic Soil Improver",
      status: "processing",
      metricA: Math.round(120 * scale),
      metricB: Math.round(24000 * scale)
    },
    {
      id: "2",
      name: "Seaweed Concentrate",
      status: "completed",
      metricA: Math.round(88 * scale),
      metricB: Math.round(17600 * scale)
    },
    {
      id: "3",
      name: "Microbial Blend",
      status: "on-hold",
      metricA: Math.round(42 * scale),
      metricB: Math.round(8900 * scale)
    }
  ].filter((row) => (filter.orderStatus === "all" ? true : row.status === filter.orderStatus));

  const forecast: ForecastPoint[] = [
    { month: "Jul", actual: Math.round(82000 * scale), predicted: Math.round(86000 * scale) },
    { month: "Aug", actual: Math.round(91000 * scale), predicted: Math.round(94000 * scale) },
    { month: "Sep", actual: Math.round(97000 * scale), predicted: Math.round(102000 * scale) },
    { month: "Oct", actual: Math.round(0 * scale), predicted: Math.round(110000 * scale) },
    { month: "Nov", actual: Math.round(0 * scale), predicted: Math.round(118000 * scale) }
  ];

  const kpis: KpiCardData[] = [
    {
      id: "orders",
      label: "Orders",
      value: formatNumber(orders),
      delta: summarizeDelta(8.2),
      positiveDelta: true
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatCurrency(revenue),
      delta: summarizeDelta(5.7),
      positiveDelta: true
    },
    {
      id: "customers",
      label: "Customers",
      value: formatNumber(customers),
      delta: summarizeDelta(2.4),
      positiveDelta: true
    },
    {
      id: "stockAlerts",
      label: "Stock Alerts",
      value: formatNumber(stockAlerts),
      delta: summarizeDelta(-3.9),
      positiveDelta: false
    }
  ];

  return Promise.resolve({ kpis, trends, rows, forecast });
}
