import { useState, useEffect, useCallback } from "react";
import { purchaseOrdersApi, PurchaseOrder } from "../api/purchaseOrdersApi";

export function usePurchaseOrders(status?: string, productId?: number) {
  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseOrdersApi.list(status, productId);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  }, [status, productId]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const updatePurchaseOrder = useCallback((id: number, patch: Partial<PurchaseOrder>) => {
    setData((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order));
  }, []);

  const upsertPurchaseOrder = useCallback((order: PurchaseOrder) => {
    setData((current) => {
      const index = current.findIndex((item) => item.id === order.id);
      if (index === -1) {
        return [order, ...current];
      }
      return current.map((item) => item.id === order.id ? order : item);
    });
  }, []);

  return { data, loading, error, refetch: fetchPOs, updatePurchaseOrder, upsertPurchaseOrder };
}
