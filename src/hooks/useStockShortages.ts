import { useEffect, useState } from "react";
import { getStockShortages } from "../api/analyticsApi";
import { useFilters } from "./useFilters";
import { TableColumn } from "../types/analytics";

type StockShortagesState = {
  records: any[];
  columns: TableColumn[];
  page: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
};

const initialState: StockShortagesState = {
  records: [],
  columns: [],
  page: 1,
  pageSize: 50,
  totalCount: 0,
  isLoading: true,
  error: null
};

export function useStockShortages(page = 1, pageSize = 50) {
  const { filters } = useFilters();
  const [state, setState] = useState<StockShortagesState>(initialState);

  useEffect(() => {
    let mounted = true;
    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    getStockShortages(filters, page, pageSize)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setState({
          records: payload.records,
          columns: payload.columns,
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
          error: error instanceof Error ? error.message : "Failed to load stock shortages."
        }));
      });

    return () => {
      mounted = false;
    };
  }, [filters, page, pageSize]);

  return state;
}
