import { useEffect, useState } from "react";
import {
  buildForecastFromTrends,
  getCustomerRecords,
  getCustomerTrends,
  getOrderRecords,
  getOrderTrends,
  getOverviewKpis,
  getStockRecords,
  getStockTrends,
} from "../api/analyticsApi";
import { ForecastPoint, KpiCardData, DynamicTableRecord, TrendPoint, TableColumn } from "../types/analytics";
import { useFilters } from "./useFilters";

type DashboardDataState = {
  kpis: KpiCardData[];
  trends: TrendPoint[];
  rows: DynamicTableRecord[];
  columns: TableColumn[];
  forecast: ForecastPoint[];
  page: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
};

const initialState: DashboardDataState = {
  kpis: [],
  trends: [],
  rows: [],
  columns: [],
  forecast: [],
  page: 1,
  pageSize: 50,
  totalCount: 0,
  isLoading: true,
  error: null
};

export function useDashboardData(domain: "overview" | "orders" | "customers" | "stock" | "forecast", page = 1, pageSize = 50) {
  const { filters } = useFilters();
  const [state, setState] = useState<DashboardDataState>(initialState);

  useEffect(() => {
    let isSubscribed = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    Promise.all([
      getOverviewKpis(filters),
      domain === "orders" || domain === "overview" || domain === "forecast"
        ? getOrderRecords(filters, page, pageSize)
        : domain === "customers"
          ? getCustomerRecords(filters, page, pageSize)
          : getStockRecords(filters, page, pageSize),
      domain === "orders" || domain === "overview" || domain === "forecast"
        ? getOrderTrends(filters)
        : domain === "customers"
          ? getCustomerTrends(filters)
          : getStockTrends(filters)
    ])
      .then(([kpis, paged, trends]) => {
        if (!isSubscribed) {
          return;
        }
        setState({
          kpis,
          trends,
          rows: paged.records,
          columns: paged.columns || [],
          forecast: buildForecastFromTrends(trends),
          page: paged.page,
          pageSize: paged.pageSize,
          totalCount: paged.totalCount,
          isLoading: false,
          error: null
        });
      })
      .catch((error: unknown) => {
        if (!isSubscribed) {
          return;
        }
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load analytics data."
        }));
      });

    return () => {
      isSubscribed = false;
    };
  }, [domain, filters, page, pageSize]);

  return state;
}
