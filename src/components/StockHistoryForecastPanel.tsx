import { useEffect, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchStockLedgerChart, getStockForecastHistory } from "../api/analyticsApi";
import { StockForecastHistoryResponse } from "../types/analytics";

type Props = {
  sku?: string | null;
  productName?: string | null;
  productId?: number | null;
  wsviGroupId?: string | null;
  canonicalProductKey?: string | null;
  lookbackDays?: number;
};

function StockHistoryForecastPanel({ sku, productName, productId, wsviGroupId, canonicalProductKey, lookbackDays = 365 }: Props) {
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [forecastHistory, setForecastHistory] = useState<StockForecastHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku && !productId && !wsviGroupId && !canonicalProductKey) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    Promise.all([
      fetchStockLedgerChart({ sku, productId, wsviGroupId }),
      getStockForecastHistory(lookbackDays, canonicalProductKey, sku),
    ])
      .then(([ledgerResult, forecastResult]) => {
        if (!isMounted) return;
        setStockHistory(ledgerResult.map((item) => ({
          ...item,
          timestamp_label: new Date(item.timestamp.replace(" ", "T")).toLocaleDateString("en-AU"),
        })));
        setForecastHistory(forecastResult);
      })
      .catch((err: any) => {
        if (isMounted) setError(err.message || "Failed to load stock history.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [sku, productId, wsviGroupId, canonicalProductKey, lookbackDays]);

  const forecastPoints = forecastHistory?.points.map((point) => ({
    ...point,
    movement_date_label: new Date(point.movement_date).toLocaleDateString("en-AU"),
  })) ?? [];

  if (isLoading) {
    return <CircularProgress size={24} />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Stack spacing={2}>
      {productName ? <Typography variant="subtitle2">{productName}</Typography> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        <Box sx={{ height: 300 }}>
          <Typography variant="caption" color="text.secondary">Stock Level History</Typography>
          {stockHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No stock ledger history found.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockHistory} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp_label" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Line type="stepAfter" dataKey="stock_qty" stroke="#1976d2" strokeWidth={2} dot={false} name="Stock Level" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
        <Box sx={{ height: 300 }}>
          <Typography variant="caption" color="text.secondary">Forecast Usage History</Typography>
          {forecastPoints.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No included forecast usage history found.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastPoints} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="movement_date_label" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="forecast_usage_qty" stroke="#2e7d32" strokeWidth={2} dot={{ r: 2 }} name="Forecast Usage Qty" />
                <Line type="monotone" dataKey="excluded_qty" stroke="#ed6c02" strokeWidth={1.5} dot={false} name="Excluded Qty" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

export default StockHistoryForecastPanel;
