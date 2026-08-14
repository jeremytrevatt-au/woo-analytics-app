import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { fetchStockLedgerChart, getStockForecastHistory } from "../api/analyticsApi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StockForecastHistoryResponse } from "../types/analytics";

interface Props {
  sku: string | null;
  productName: string | null;
  productId?: number | null;
  wsviGroupId?: string | null;
  canonicalProductKey?: string | null;
  lookbackDays?: number;
  onClose: () => void;
}

export default function StockLedgerChartModal({ sku, productName, productId, wsviGroupId, canonicalProductKey, lookbackDays = 365, onClose }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [forecastHistory, setForecastHistory] = useState<StockForecastHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku && !productId && !wsviGroupId && !canonicalProductKey) return;
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [ledgerResult, forecastResult] = await Promise.all([
          fetchStockLedgerChart({ sku, productId, wsviGroupId }),
          getStockForecastHistory(lookbackDays, canonicalProductKey, sku)
        ]);
        if (isMounted) {
          // Parse dates for the chart
          const formatted = ledgerResult.map((item) => {
            let dateObj = new Date(item.timestamp.replace(' ', 'T'));
            return {
              ...item,
              timestamp: dateObj.toLocaleString("en-AU"),
              dateObj,
            };
          });
          setData(formatted);
          setForecastHistory(forecastResult);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [sku, productId, wsviGroupId, canonicalProductKey, lookbackDays]);

  const forecastPoints = forecastHistory?.points.map((point) => ({
    ...point,
    movement_date_label: new Date(point.movement_date).toLocaleDateString("en-AU"),
  })) ?? [];
  const includedUsageQty = forecastPoints.reduce((total, point) => total + Number(point.forecast_usage_qty || 0), 0);
  const excludedUsageQty = forecastPoints.reduce((total, point) => total + Number(point.excluded_qty || 0), 0);
  const firstLedgerDate = data[0]?.timestamp ?? "-";
  const lastLedgerDate = data[data.length - 1]?.timestamp ?? "-";
  const firstForecastDate = forecastPoints[0]?.movement_date_label ?? "-";
  const lastForecastDate = forecastPoints[forecastPoints.length - 1]?.movement_date_label ?? "-";

  return (
    <Dialog open={!!sku || !!productId || !!wsviGroupId || !!canonicalProductKey} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Stock History & Forecast: {sku || wsviGroupId || productId}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {productName && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {productName}
          </Typography>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2 }}>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Live Ledger Points</Typography>
            <Typography variant="h6">{data.length}</Typography>
            <Typography variant="caption" color="text.secondary">{firstLedgerDate} to {lastLedgerDate}</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Order-Derived Usage Points</Typography>
            <Typography variant="h6">{forecastPoints.length}</Typography>
            <Typography variant="caption" color="text.secondary">
              Included {includedUsageQty} | Excluded {excludedUsageQty} | {firstForecastDate} to {lastForecastDate}
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle2" gutterBottom>Stock Level History</Typography>
        <Box sx={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isLoading ? (
            <CircularProgress />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : data.length === 0 ? (
            <Typography color="text.secondary">No history found for this SKU.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 12 }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                <YAxis />
                <Tooltip />
                <Line type="stepAfter" dataKey="stock_qty" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} name="Stock Level" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Forecast Usage History</Typography>
        <Box sx={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isLoading ? (
            <CircularProgress />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : forecastPoints.length === 0 ? (
            <Typography color="text.secondary">No forecast usage history found for this item.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastPoints} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="movement_date_label"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="forecast_usage_qty" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} name="Forecast Usage Qty" />
                <Line type="monotone" dataKey="excluded_qty" stroke="#ed6c02" strokeWidth={1.5} dot={false} name="Excluded Qty" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Live Ledger Detail</Typography>
        <Box sx={{ maxHeight: 260, overflow: "auto", mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell align="right">Stock Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={`${item.timestamp}-${index}`}>
                  <TableCell>{item.timestamp}</TableCell>
                  <TableCell align="right">{item.stock_qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography variant="subtitle2" gutterBottom>Order-Derived Forecast Detail</Typography>
        <Box sx={{ maxHeight: 320, overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Included Usage</TableCell>
                <TableCell align="right">Excluded Qty</TableCell>
                <TableCell align="right">Included Lines</TableCell>
                <TableCell align="right">Excluded Lines</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecastPoints.map((point) => (
                <TableRow key={`${point.movement_date}-${point.canonical_product_key}-${point.sku}`}>
                  <TableCell>{point.movement_date_label}</TableCell>
                  <TableCell>{point.sku}</TableCell>
                  <TableCell>{point.product_name}</TableCell>
                  <TableCell align="right">{point.forecast_usage_qty}</TableCell>
                  <TableCell align="right">{point.excluded_qty}</TableCell>
                  <TableCell align="right">{point.included_lines}</TableCell>
                  <TableCell align="right">{point.excluded_lines}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
