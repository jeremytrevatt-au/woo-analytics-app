import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow, FormControlLabel, Switch, TextField, MenuItem } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { fetchStockLedgerChart, getStockForecastHistory } from "../api/analyticsApi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StockForecastHistoryResponse } from "../types/analytics";

type LookbackMode = number | "dynamic";
type AnalysisAggregation = "day" | "week" | "month";

interface Props {
  sku: string | null;
  productName: string | null;
  productId?: number | null;
  wsviGroupId?: string | null;
  canonicalProductKey?: string | null;
  lookbackDays?: LookbackMode;
  startDate?: string | null;
  endDate?: string | null;
  onClose: () => void;
}

function chooseDynamicLookback(points: Array<{ dateObj: Date; forecast_usage_qty: number }>): number {
  const candidates = [7, 14, 30, 60, 90, 180, 365];
  const latestDate = points[points.length - 1]?.dateObj;
  if (!latestDate) return 30;

  let best = { days: 30, relativeStandardError: Number.POSITIVE_INFINITY };
  for (const days of candidates) {
    const earliest = new Date(latestDate);
    earliest.setDate(earliest.getDate() - days);
    const values = points
      .filter((point) => point.dateObj >= earliest)
      .map((point) => point.forecast_usage_qty)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length < 5) continue;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mean <= 0) continue;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const relativeStandardError = Math.sqrt(variance) / Math.sqrt(values.length) / mean;
    if (relativeStandardError < best.relativeStandardError) {
      best = { days, relativeStandardError };
    }
  }
  return best.days;
}

function addRollingAverage(points: Array<any>, lookbackDays: number): Array<any> {
  return points.map((point) => {
    const earliest = new Date(point.dateObj);
    earliest.setDate(earliest.getDate() - lookbackDays);
    const windowValues = points
      .filter((candidate) => candidate.dateObj >= earliest && candidate.dateObj <= point.dateObj)
      .map((candidate) => Number(candidate.forecast_usage_qty || 0));
    const average = windowValues.length > 0
      ? windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length
      : 0;
    return {
      ...point,
      rolling_average_qty: average,
    };
  });
}

function bucketStart(date: Date, aggregation: AnalysisAggregation): Date {
  const bucket = new Date(date);
  bucket.setHours(0, 0, 0, 0);
  if (aggregation === "week") {
    const day = bucket.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    bucket.setDate(bucket.getDate() + diff);
  } else if (aggregation === "month") {
    bucket.setDate(1);
  }
  return bucket;
}

function bucketKey(date: Date, aggregation: AnalysisAggregation): string {
  return bucketStart(date, aggregation).toISOString().slice(0, 10);
}

function bucketLabel(date: Date, aggregation: AnalysisAggregation): string {
  if (aggregation === "week") {
    return `Week of ${date.toLocaleDateString("en-AU")}`;
  }
  if (aggregation === "month") {
    return date.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
  }
  return date.toLocaleDateString("en-AU");
}

function aggregateStockLevels(points: Array<any>, aggregation: AnalysisAggregation): Array<any> {
  const buckets = new Map<string, any>();
  [...points]
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .forEach((point) => {
      const start = bucketStart(point.dateObj, aggregation);
      const key = bucketKey(point.dateObj, aggregation);
      buckets.set(key, {
        ...point,
        bucket_date: key,
        bucket_label: bucketLabel(start, aggregation),
        dateObj: start,
        stock_qty: Number(point.stock_qty ?? point.new_stock_level ?? 0),
      });
    });
  return Array.from(buckets.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
}

function aggregateUsagePoints(points: Array<any>, aggregation: AnalysisAggregation): Array<any> {
  const buckets = new Map<string, any>();
  points.forEach((point) => {
    const start = bucketStart(point.dateObj, aggregation);
    const key = bucketKey(point.dateObj, aggregation);
    const existing = buckets.get(key) ?? {
      ...point,
      bucket_date: key,
      movement_date_label: bucketLabel(start, aggregation),
      dateObj: start,
      forecast_usage_qty: 0,
      excluded_qty: 0,
      included_lines: 0,
      excluded_lines: 0,
    };
    existing.forecast_usage_qty += Number(point.forecast_usage_qty || 0);
    existing.excluded_qty += Number(point.excluded_qty || 0);
    existing.included_lines += Number(point.included_lines || 0);
    existing.excluded_lines += Number(point.excluded_lines || 0);
    buckets.set(key, existing);
  });
  return Array.from(buckets.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
}

function calculateAverageDailyUsage(points: Array<any>, lookbackDays: number): number {
  const latestDate = points[points.length - 1]?.dateObj;
  if (!latestDate) return 0;
  const earliest = new Date(latestDate);
  earliest.setDate(earliest.getDate() - lookbackDays);
  const usageQty = points
    .filter((point) => point.dateObj >= earliest && point.dateObj <= latestDate)
    .reduce((total, point) => total + Number(point.forecast_usage_qty || 0), 0);
  return usageQty > 0 ? usageQty / Math.max(lookbackDays, 1) : 0;
}

function buildStockLevelForecast(points: Array<any>, averageDailyUsage: number, aggregation: AnalysisAggregation): Array<any> {
  if (points.length === 0) return [];
  const actual = points.map((point) => ({
    ...point,
    projected_stock_qty: null as number | null,
  }));
  const last = actual[actual.length - 1];
  const projected = [...actual];
  projected[projected.length - 1] = {
    ...last,
    projected_stock_qty: last.stock_qty,
  };

  const futureBuckets = aggregation === "day" ? 30 : aggregation === "week" ? 12 : 12;
  for (let index = 1; index <= futureBuckets; index += 1) {
    const date = new Date(last.dateObj);
    if (aggregation === "day") date.setDate(date.getDate() + index);
    else if (aggregation === "week") date.setDate(date.getDate() + index * 7);
    else date.setMonth(date.getMonth() + index);

    const elapsedDays = Math.max(1, Math.round((date.getTime() - last.dateObj.getTime()) / 86400000));
    projected.push({
      bucket_date: bucketKey(date, aggregation),
      bucket_label: bucketLabel(bucketStart(date, aggregation), aggregation),
      dateObj: bucketStart(date, aggregation),
      stock_qty: null,
      projected_stock_qty: Math.max(0, Number(last.stock_qty || 0) - averageDailyUsage * elapsedDays),
    });
  }
  return projected;
}

export default function StockLedgerChartModal({ sku, productName, productId, wsviGroupId, canonicalProductKey, lookbackDays = 365, startDate, endDate, onClose }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [forecastHistory, setForecastHistory] = useState<StockForecastHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAverageLine, setShowAverageLine] = useState(true);
  const [aggregation, setAggregation] = useState<AnalysisAggregation>("day");
  const [localLookbackDays, setLocalLookbackDays] = useState<LookbackMode>(lookbackDays);

  useEffect(() => {
    setLocalLookbackDays(lookbackDays);
  }, [lookbackDays]);

  useEffect(() => {
    if (!sku && !productId && !wsviGroupId && !canonicalProductKey) return;
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiLookbackDays = localLookbackDays === "dynamic" ? 365 : localLookbackDays;
        const [ledgerResult, forecastResult] = await Promise.all([
          fetchStockLedgerChart({ sku, productId, wsviGroupId, startDate, endDate }),
          getStockForecastHistory(apiLookbackDays, canonicalProductKey, sku, startDate, endDate)
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
  }, [sku, productId, wsviGroupId, canonicalProductKey, localLookbackDays, startDate, endDate]);

  const rawForecastPoints = forecastHistory?.points.map((point) => ({
    ...point,
    dateObj: new Date(point.movement_date),
    movement_date_label: new Date(point.movement_date).toLocaleDateString("en-AU"),
    forecast_usage_qty: Number(point.forecast_usage_qty || 0),
    excluded_qty: Number(point.excluded_qty || 0),
  })) ?? [];
  const effectiveLookbackDays = localLookbackDays === "dynamic"
    ? chooseDynamicLookback(rawForecastPoints)
    : localLookbackDays;
  const aggregatedStockPoints = aggregateStockLevels(data, aggregation);
  const averageDailyUsage = calculateAverageDailyUsage(rawForecastPoints, effectiveLookbackDays);
  const stockLevelChartPoints = buildStockLevelForecast(aggregatedStockPoints, averageDailyUsage, aggregation);
  const forecastPoints = addRollingAverage(aggregateUsagePoints(rawForecastPoints, aggregation), effectiveLookbackDays);
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
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px 220px auto" }, gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            select
            size="small"
            label="Aggregation"
            value={aggregation}
            onChange={(event) => setAggregation(event.target.value as AnalysisAggregation)}
          >
            <MenuItem value="day">Daily</MenuItem>
            <MenuItem value="week">Weekly</MenuItem>
            <MenuItem value="month">Monthly</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Forecast Average"
            value={localLookbackDays}
            onChange={(event) => {
              const value = event.target.value;
              setLocalLookbackDays(value === "dynamic" ? "dynamic" : Number(value));
            }}
          >
            <MenuItem value={7}>Last 7 Days</MenuItem>
            <MenuItem value={14}>Last 14 Days</MenuItem>
            <MenuItem value={30}>Last 30 Days</MenuItem>
            <MenuItem value={60}>Last 60 Days</MenuItem>
            <MenuItem value={90}>Last 90 Days</MenuItem>
            <MenuItem value={180}>Last 180 Days</MenuItem>
            <MenuItem value={365}>Last 365 Days</MenuItem>
            <MenuItem value="dynamic">Dynamic</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch size="small" checked={showAverageLine} onChange={(event) => setShowAverageLine(event.target.checked)} />}
            label="Average/forecast line"
          />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2 }}>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Live Ledger Points</Typography>
            <Typography variant="h6">{aggregatedStockPoints.length}</Typography>
            <Typography variant="caption" color="text.secondary">{firstLedgerDate} to {lastLedgerDate}</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">Historical Usage Inputs</Typography>
            <Typography variant="h6">{forecastPoints.length}</Typography>
            <Typography variant="caption" color="text.secondary">
              Included {includedUsageQty} | Excluded {excludedUsageQty} | {firstForecastDate} to {lastForecastDate} | Avg {averageDailyUsage.toFixed(2)}/day over {effectiveLookbackDays}d
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle2" gutterBottom>Stock Level & Forecast</Typography>
        <Box sx={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isLoading ? (
            <CircularProgress />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : stockLevelChartPoints.length === 0 ? (
            <Typography color="text.secondary">No history found for this SKU.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockLevelChartPoints} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="bucket_label" 
                  tick={{ fontSize: 12 }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                <YAxis />
                <Tooltip />
                <Line type="stepAfter" dataKey="stock_qty" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} name="Stock Level" />
                {showAverageLine ? (
                  <Line type="monotone" dataKey="projected_stock_qty" stroke="#6a1b9a" strokeWidth={2} dot={false} name={`${effectiveLookbackDays}d Forecast Stock Level`} />
                ) : null}
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
              {aggregatedStockPoints.map((item, index) => (
                <TableRow key={`${item.bucket_date}-${index}`}>
                  <TableCell>{item.bucket_label}</TableCell>
                  <TableCell align="right">{item.stock_qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography variant="subtitle2" gutterBottom>Historical Usage Inputs</Typography>
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
