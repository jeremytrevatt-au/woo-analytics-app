import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Checkbox, Chip, CircularProgress, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, OutlinedInput, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCategories, getDrilldownChart } from "../api/analyticsApi";
import { ProductSearchResult } from "../api/productsApi";
import ProductSearchAutocomplete from "../components/ProductSearchAutocomplete";
import { DrilldownDimension, DrilldownMetric, DrilldownPoint } from "../types/analytics";
import { useFilters } from "../hooks/useFilters";

type AverageWindow = 7 | 14 | 30 | 60 | 90 | "dynamic";
type ChartType = "line" | "bar";

const COLORS = ["#1976d2", "#2e7d32", "#ed6c02", "#6a1b9a", "#00838f", "#ad1457", "#5d4037", "#7b1fa2", "#455a64", "#558b2f"];

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function bucketLabel(value: string): string {
  return parseDate(value).toLocaleDateString("en-AU");
}

function advanceDate(date: Date, granularity: string, steps: number): Date {
  const next = new Date(date);
  if (granularity === "week") next.setDate(next.getDate() + steps * 7);
  else if (granularity === "month") next.setMonth(next.getMonth() + steps);
  else if (granularity === "quarter") next.setMonth(next.getMonth() + steps * 3);
  else if (granularity === "year") next.setFullYear(next.getFullYear() + steps);
  else next.setDate(next.getDate() + steps);
  return next;
}

function chooseDynamicWindow(points: DrilldownPoint[]): number {
  const candidates = [7, 14, 30, 60, 90];
  const parsed = points
    .map((point) => ({ dateObj: parseDate(point.bucket_date), value: Number(point.actual_value || 0) }))
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  const latestDate = parsed[parsed.length - 1]?.dateObj;
  if (!latestDate) return 30;

  let best = { days: 30, relativeStandardError: Number.POSITIVE_INFINITY };
  for (const days of candidates) {
    const earliest = new Date(latestDate);
    earliest.setDate(earliest.getDate() - days);
    const values = parsed.filter((point) => point.dateObj >= earliest).map((point) => point.value).filter((value) => value > 0);
    if (values.length < 3) continue;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mean <= 0) continue;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const relativeStandardError = Math.sqrt(variance) / Math.sqrt(values.length) / mean;
    if (relativeStandardError < best.relativeStandardError) best = { days, relativeStandardError };
  }
  return best.days;
}

function seriesId(index: number, suffix: string): string {
  return `series_${index}_${suffix}`;
}

function buildChart(points: DrilldownPoint[], averageWindow: AverageWindow, granularity: string) {
  const effectiveWindow = averageWindow === "dynamic" ? chooseDynamicWindow(points) : averageWindow;
  const bySeries = new Map<string, Array<DrilldownPoint & { dateObj: Date; actual: number }>>();
  points.forEach((point) => {
    const next = {
      ...point,
      dateObj: parseDate(point.bucket_date),
      actual: Number(point.actual_value || 0),
    };
    bySeries.set(point.series_key, [...(bySeries.get(point.series_key) || []), next]);
  });

  const byDate = new Map<string, Record<string, string | number | null>>();
  const series = Array.from(bySeries.entries()).map(([key, rawPoints], index) => {
    const label = rawPoints[0]?.series_label || key;
    const sorted = rawPoints.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    sorted.forEach((point) => {
      const earliest = new Date(point.dateObj);
      earliest.setDate(earliest.getDate() - effectiveWindow);
      const windowValues = sorted
        .filter((candidate) => candidate.dateObj >= earliest && candidate.dateObj <= point.dateObj)
        .map((candidate) => candidate.actual);
      const average = windowValues.length > 0 ? windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length : null;
      const row = byDate.get(point.bucket_date) || { bucket_date: point.bucket_date, label: bucketLabel(point.bucket_date) };
      row[seriesId(index, "actual")] = point.actual;
      row[seriesId(index, "average")] = average;
      byDate.set(point.bucket_date, row);
    });

    const last = sorted[sorted.length - 1];
    if (last) {
      const lastRow = byDate.get(last.bucket_date) || { bucket_date: last.bucket_date, label: bucketLabel(last.bucket_date) };
      lastRow[seriesId(index, "forecast")] = lastRow[seriesId(index, "average")] as number | null;
      byDate.set(last.bucket_date, lastRow);

      for (let step = 1; step <= 3; step += 1) {
        const forecastDate = advanceDate(last.dateObj, granularity, step).toISOString().slice(0, 10);
        const row = byDate.get(forecastDate) || { bucket_date: forecastDate, label: bucketLabel(forecastDate) };
        row[seriesId(index, "forecast")] = lastRow[seriesId(index, "average")] as number | null;
        byDate.set(forecastDate, row);
      }
    }

    return { key, label, index, color: COLORS[index % COLORS.length] };
  });

  const rows = Array.from(byDate.values()).sort((a, b) => String(a.bucket_date).localeCompare(String(b.bucket_date)));
  return { rows, series, effectiveWindow };
}

function DrillDownPage() {
  const { filters } = useFilters();
  const [metric, setMetric] = useState<DrilldownMetric>("revenue");
  const [dimension, setDimension] = useState<DrilldownDimension>("category");
  const [averageWindow, setAverageWindow] = useState<AverageWindow>(30);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showActual, setShowActual] = useState(true);
  const [showAverage, setShowAverage] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductSearchResult[]>([]);
  const [points, setPoints] = useState<DrilldownPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const selectedValues = dimension === "category"
    ? selectedCategories
    : selectedProducts.map((product) => product.sku).filter(Boolean);
  const selectionLimit = dimension === "category" ? 5 : 10;

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setError(null);
    getDrilldownChart(filters, metric, dimension, selectedValues, selectionLimit)
      .then((response) => {
        if (isSubscribed) setPoints(response.points || []);
      })
      .catch((error: any) => {
        if (isSubscribed) setError(error.message || "Failed to load drilldown chart.");
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });
    return () => {
      isSubscribed = false;
    };
  }, [filters, metric, dimension, selectedValues.join("|"), selectionLimit]);

  const chart = useMemo(() => buildChart(points, averageWindow, filters.granularity), [points, averageWindow, filters.granularity]);
  const metricLabel = metric === "revenue" ? "Revenue" : metric === "orders" ? "Orders" : metric === "units_sold" ? "Units Sold" : "Average Order Value";

  const renderSeries = (dataKey: string, name: string, color: string, dashed = false) => {
    if (chartType === "bar") {
      return <Bar key={dataKey} dataKey={dataKey} name={name} fill={color} fillOpacity={dashed ? 0.45 : 0.8} />;
    }
    return <Line key={dataKey} type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={false} strokeDasharray={dashed ? "5 5" : undefined} />;
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Drill Down</Typography>
      <Typography variant="body2" color="text.secondary">
        Compare revenue and order metrics by selected categories or SKUs with rolling averages and forecast projection.
      </Typography>

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <TextField select fullWidth size="small" label="Metric" value={metric} onChange={(event) => setMetric(event.target.value as DrilldownMetric)}>
                <MenuItem value="revenue">Revenue</MenuItem>
                <MenuItem value="orders">Orders</MenuItem>
                <MenuItem value="units_sold">Units Sold</MenuItem>
                <MenuItem value="aov">Average Order Value</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField select fullWidth size="small" label="Dimension" value={dimension} onChange={(event) => setDimension(event.target.value as DrilldownDimension)}>
                <MenuItem value="category">Category</MenuItem>
                <MenuItem value="sku">SKU</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField select fullWidth size="small" label="Rolling Average" value={averageWindow} onChange={(event) => setAverageWindow(event.target.value === "dynamic" ? "dynamic" : Number(event.target.value) as AverageWindow)}>
                <MenuItem value={7}>7 Days</MenuItem>
                <MenuItem value={14}>14 Days</MenuItem>
                <MenuItem value={30}>30 Days</MenuItem>
                <MenuItem value={60}>60 Days</MenuItem>
                <MenuItem value={90}>90 Days</MenuItem>
                <MenuItem value="dynamic">Dynamic</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              {dimension === "category" ? (
                <FormControl fullWidth size="small">
                  <InputLabel>Categories</InputLabel>
                  <Select
                    multiple
                    value={selectedCategories}
                    input={<OutlinedInput label="Categories" />}
                    renderValue={(selected) => selected.join(", ")}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedCategories((typeof value === "string" ? value.split(",") : value).slice(0, 5));
                    }}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        <Checkbox checked={selectedCategories.includes(category)} />
                        <Typography variant="body2">{category}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <ProductSearchAutocomplete
                  value={null}
                  label="Add SKU"
                  onChange={(product) => {
                    if (!product?.sku) return;
                    setSelectedProducts((previous) => previous.some((item) => item.sku === product.sku) || previous.length >= 10 ? previous : [...previous, product]);
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <ToggleButtonGroup size="small" exclusive value={chartType} onChange={(_, value) => value && setChartType(value)}>
                  <ToggleButton value="line">Line</ToggleButton>
                  <ToggleButton value="bar">Bar</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel control={<Switch size="small" checked={showActual} onChange={(event) => setShowActual(event.target.checked)} />} label="Actual" />
                <FormControlLabel control={<Switch size="small" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} />} label="Average" />
                <FormControlLabel control={<Switch size="small" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} />} label="Forecast" />
              </Stack>
            </Grid>
          </Grid>
          {dimension === "sku" && selectedProducts.length > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
              {selectedProducts.map((product) => (
                <Chip key={product.sku} label={product.sku} onDelete={() => setSelectedProducts((previous) => previous.filter((item) => item.sku !== product.sku))} />
              ))}
            </Stack>
          ) : null}
          {selectedValues.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No {dimension === "category" ? "categories" : "SKUs"} selected. Showing the top {selectionLimit} by {metricLabel.toLowerCase()}.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card sx={{ height: 520, width: "100%", minWidth: 0 }}>
        <CardContent sx={{ height: "100%", width: "100%", minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{metricLabel} by {dimension === "category" ? "Category" : "SKU"}</Typography>
            <Typography variant="caption" color="text.secondary">Rolling window: {chart.effectiveWindow} days</Typography>
          </Stack>
          <Box sx={{ height: 450, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loading ? (
              <CircularProgress />
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : chart.rows.length === 0 ? (
              <Typography color="text.secondary">No drilldown data found for the selected filters.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart.rows} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {chart.series.flatMap((series) => [
                    showActual ? renderSeries(seriesId(series.index, "actual"), `${series.label} Actual`, series.color) : null,
                    showAverage ? renderSeries(seriesId(series.index, "average"), `${series.label} Avg`, series.color, true) : null,
                    showForecast ? renderSeries(seriesId(series.index, "forecast"), `${series.label} Forecast`, series.color, true) : null,
                  ])}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default DrillDownPage;
