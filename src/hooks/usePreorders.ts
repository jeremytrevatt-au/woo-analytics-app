import { useCallback, useEffect, useState } from "react";
import {
  preordersApi,
  PreorderAllocation,
  PreorderDiagnostics,
  PreorderReservation
} from "../api/preordersApi";

export function usePreorders() {
  const [diagnostics, setDiagnostics] = useState<PreorderDiagnostics | null>(null);
  const [allocations, setAllocations] = useState<PreorderAllocation[]>([]);
  const [reservations, setReservations] = useState<PreorderReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [diagnosticsResult, allocationResult, reservationResult] = await Promise.all([
        preordersApi.diagnostics(),
        preordersApi.listAllocations(),
        preordersApi.listReservations()
      ]);
      setDiagnostics(diagnosticsResult);
      setAllocations(allocationResult);
      setReservations(reservationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch preorder data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { diagnostics, allocations, reservations, loading, error, refetch };
}
