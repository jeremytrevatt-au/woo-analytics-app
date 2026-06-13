import { useEffect, useState } from "react";
import {
  buildForecastFromRows,
  buildOverviewTrends,
  getCustomerRecords,
  getOrderRecords,
  getOverviewKpis,
  getStockRecords
} from "../api/analyticsApi";
import { ForecastPoint, KpiCardData, TableRecord, TrendPoint } from "../types/analytics";
import { useFilters } from "./useFilters";

type DashboardDataState = {
  kpis: KpiCardData[];
  trends: TrendPoint[];
  rows: TableRecord[];
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
          : getStockRecords(filters, page, pageSize)
    ])
      .then(([kpis, paged]) => {
        if (!isSubscribed) {
          return;
        }
        setState({
          kpis,
          trends: buildOverviewTrends(paged.records),
          rows: paged.records,
          forecast: buildForecastFromRows(paged.records),
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
