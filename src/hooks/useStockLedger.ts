import { useState, useEffect } from "react";
import { fetchStockLedger } from "../api/analyticsApi";
import { useFilters } from "./useFilters";
import { StockLedgerResponse } from "../types/analytics";

export function useStockLedger(page: number, pageSize: number, reason: string | null, localSearch: string = "") {
  const { filters } = useFilters();
  const [data, setData] = useState<StockLedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchStockLedger(filters, page, pageSize, reason, localSearch);
        if (isMounted) setData(result);
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [filters, page, pageSize, reason, localSearch]);

  return { data, isLoading, error };
}
