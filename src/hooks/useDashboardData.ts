import { useEffect, useState } from "react";
import { getDashboardPayload } from "../api/analyticsApi";
import { ForecastPoint, KpiCardData, TableRecord, TrendPoint } from "../types/analytics";
import { useFilters } from "./useFilters";

type DashboardDataState = {
  kpis: KpiCardData[];
  trends: TrendPoint[];
  rows: TableRecord[];
  forecast: ForecastPoint[];
  isLoading: boolean;
  error: string | null;
};

const initialState: DashboardDataState = {
  kpis: [],
  trends: [],
  rows: [],
  forecast: [],
  isLoading: true,
  error: null
};

export function useDashboardData() {
  const { filters } = useFilters();
  const [state, setState] = useState<DashboardDataState>(initialState);

  useEffect(() => {
    let isSubscribed = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    getDashboardPayload(filters)
      .then((payload) => {
        if (!isSubscribed) {
          return;
        }
        setState({
          kpis: payload.kpis,
          trends: payload.trends,
          rows: payload.rows,
          forecast: payload.forecast,
          isLoading: false,
          error: null
        });
      })
      .catch(() => {
        if (!isSubscribed) {
          return;
        }
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: "Failed to load analytics data."
        }));
      });

    return () => {
      isSubscribed = false;
    };
  }, [filters]);

  return state;
}
