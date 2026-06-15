import { useEffect, useState } from "react";
import { getStockForecast } from "../api/analyticsApi";
import { StockForecastRecord } from "../types/analytics";
import { useFilters } from "./useFilters";

type StockForecastState = {
  records: StockForecastRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
};

const initialState: StockForecastState = {
  records: [],
  page: 1,
  pageSize: 50,
  totalCount: 0,
  isLoading: true,
  error: null
};

export function useStockForecast(page = 1, pageSize = 50, leadTimeDays = 90, method = "sma", lookbackDays = 365) {
  const { filters } = useFilters();
  const [state, setState] = useState<StockForecastState>(initialState);

  useEffect(() => {
    let mounted = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    getStockForecast(leadTimeDays, page, pageSize, filters.searchText, method, lookbackDays, filters.category, filters.skuStartsWith, filters.skuContains, filters.skuEndsWith)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setState({
          records: payload.records,
          page: payload.page,
          pageSize: payload.pageSize,
          totalCount: payload.totalCount,
          isLoading: false,
          error: null
        });
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load stock forecast."
        }));
      });

    return () => {
      mounted = false;
    };
  }, [filters.searchText, leadTimeDays, page, pageSize, method, lookbackDays, filters.category, filters.skuStartsWith, filters.skuContains, filters.skuEndsWith]);

  return state;
}
