import { useCallback, useEffect, useRef, useState } from "react";
import { getPackingOrders } from "../api/analyticsApi";
import { useFilters } from "./useFilters";

const PACKING_REFRESH_INTERVAL_MS = 5000;

type PackingOrdersState = {
  rows: any[];
  currentUser: string;
  isLoading: boolean;
  error: string | null;
};

const initialState: PackingOrdersState = {
  rows: [],
  currentUser: "",
  isLoading: true,
  error: null,
};

export function usePackingOrders(page = 1, pageSize = 100) {
  const { filters } = useFilters();
  const [state, setState] = useState<PackingOrdersState>(initialState);
  const requestSequence = useRef(0);

  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++requestSequence.current;
    if (showLoading) {
      setState(previous => ({ ...previous, isLoading: true, error: null }));
    }

    try {
      const response = await getPackingOrders(filters, page, pageSize);
      if (requestId !== requestSequence.current) return;
      setState({
        rows: response.records,
        currentUser: response.currentUser,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setState(previous => ({
        ...previous,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to refresh packing orders.",
      }));
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void refresh(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(false);
      }
    }, PACKING_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh(false);
      }
    };
    const handleFocus = () => void refresh(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  const updateOrderStatus = useCallback((orderId: number, status: string, packedBy: string) => {
    setState(previous => ({
      ...previous,
      rows: previous.rows.map(order => (
        Number(order.order_id) === Number(orderId)
          ? {
              ...order,
              status,
              packed_by: packedBy,
              is_packed: status === "packed",
            }
          : order
      )),
    }));
  }, []);

  return {
    ...state,
    refetch: () => refresh(false),
    updateOrderStatus,
  };
}
