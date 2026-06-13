export type AppFilterState = {
  dateRange: "7d" | "30d" | "90d";
  orderStatus: "all" | "processing" | "completed" | "on-hold";
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
};

export type ForecastPoint = {
  month: string;
  actual: number;
  predicted: number;
};
