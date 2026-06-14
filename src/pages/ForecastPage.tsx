import { useState } from "react";
import { Stack, Typography, TextField, MenuItem, Grid } from "@mui/material";
import ForecastPanel from "../components/ForecastPanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import DataTablePanel from "../components/DataTablePanel";
import { useStockForecast } from "../hooks/useStockForecast";

function ForecastPage() {
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState("sma");
  const { forecast, isLoading, error } = useDashboardData("forecast", 1, 20);
  const stockForecast = useStockForecast(page, 20, 90, method);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Forecast
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Compare expected revenue trajectory with current actual performance.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && forecast.length === 0} />
      {!isLoading && !error && forecast.length > 0 ? <ForecastPanel forecast={forecast} /> : null}
      
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <Typography variant="h6" fontWeight={700}>
            Stock Reorder Forecast (90 day lead time)
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
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
            { key: "sku", label: "SKU", type: "string" },
            { key: "currentStockQty", label: "Current Stock", type: "number" },
            { key: "avgDailyUsage", label: "Avg Daily Usage", type: "number" },
            { key: "daysOfCover", label: "Days of Cover", type: "number" },
            { key: "projectedStockoutDate", label: "Projected Stockout", type: "date" },
            { key: "reorderWithinLeadTime", label: "Needs Reorder", type: "boolean" },
          ]}
          page={stockForecast.page}
          pageSize={stockForecast.pageSize}
          totalCount={stockForecast.totalCount}
          onPageChange={setPage}
        />
      ) : null}
    </Stack>
  );
}

export default ForecastPage;
