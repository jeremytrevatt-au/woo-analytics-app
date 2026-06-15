import { useState } from "react";
import { Stack, Typography, Grid, TextField, MenuItem } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStockForecast } from "../hooks/useStockForecast";

function StockPage() {
  const [page, setPage] = useState(1);
  const [forecastPage, setForecastPage] = useState(1);
  const [method, setMethod] = useState("sma");
  const [lookbackDays, setLookbackDays] = useState(365);
  
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("stock", page, 50);
  const stockForecast = useStockForecast(forecastPage, 20, 90, method, lookbackDays);
  const stockKpi = kpis.find((item) => item.id === "stockAlerts");

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Stock
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Track out-of-stock risk and stock movement by SKU and product line.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error ? (
        <>
          <KpiGrid cards={stockKpi ? [stockKpi] : []} />
          <TrendsChartPanel title="Stock Trend" data={trends} domain="stock" />
          <DataTablePanel
            title="Stock Records"
            rows={rows as any}
            columns={columns}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            getLinkUrl={(row, col) => col.key === "product_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
          />
        </>
      ) : null}
      
      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight={700}>
            Stock Reorder Forecast (90 day lead time)
          </Typography>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Forecasting Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            size="small"
          >
            <MenuItem value="sma">Simple Moving Average</MenuItem>
            <MenuItem value="ema">Exponential Moving Average</MenuItem>
            <MenuItem value="linear">Linear Regression</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Lookback Period"
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            size="small"
          >
            <MenuItem value={30}>Last 30 Days</MenuItem>
            <MenuItem value={60}>Last 60 Days</MenuItem>
            <MenuItem value={90}>Last 90 Days</MenuItem>
            <MenuItem value={180}>Last 180 Days</MenuItem>
            <MenuItem value={365}>Last 365 Days</MenuItem>
          </TextField>
        </Grid>
      </Grid>
      
      <LoadStateBlock
        isLoading={stockForecast.isLoading}
        error={stockForecast.error}
        empty={!stockForecast.isLoading && !stockForecast.error && stockForecast.records.length === 0}
      />
      {!stockForecast.isLoading && !stockForecast.error ? (
          <DataTablePanel
            title=""
            rows={stockForecast.records as any}
            columns={[
              { key: "sku", label: "Base SKU", type: "string" },
              { key: "currentStockQty", label: "Shared Stock Pool", type: "number" },
              { key: "avgDailyUsage", label: "Avg Daily Usage (Base Units)", type: "number" },
              { key: "daysOfCover", label: "Days of Cover", type: "number" },
              { key: "projectedStockoutDate", label: "Projected Stockout", type: "date" },
              { key: "reorderWithinLeadTime", label: "Needs Reorder", type: "boolean" },
            ]}
            page={stockForecast.page}
            pageSize={stockForecast.pageSize}
            totalCount={stockForecast.totalCount}
            onPageChange={setForecastPage}
            getLinkUrl={(row, col) => col.key === "sku" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.productId}&action=edit` : null}
          />
      ) : null}
    </Stack>
  );
}

export default StockPage;
