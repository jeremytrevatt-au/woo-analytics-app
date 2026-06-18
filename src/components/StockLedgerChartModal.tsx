import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { fetchStockLedgerChart } from "../api/analyticsApi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  sku: string | null;
  productName: string | null;
  onClose: () => void;
}

export default function StockLedgerChartModal({ sku, productName, onClose }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) return;
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchStockLedgerChart(sku);
        if (isMounted) {
          // Parse dates for the chart
          const formatted = result.map((item) => {
            let dateObj = new Date(item.timestamp.replace(' ', 'T'));
            return {
              ...item,
              timestamp: dateObj.toLocaleString("en-AU"),
              dateObj,
            };
          });
          setData(formatted);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [sku]);

  return (
    <Dialog open={!!sku} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Stock History: {sku}
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
        <Box sx={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      </DialogContent>
    </Dialog>
  );
}
