import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import ForecastPanel from "../components/ForecastPanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import DataTablePanel from "../components/DataTablePanel";
import { useStockForecast } from "../hooks/useStockForecast";
import { TableRecord } from "../types/analytics";

function ForecastPage() {
  const [page, setPage] = useState(1);
  const { forecast, isLoading, error } = useDashboardData("forecast", 1, 20);
  const stockForecast = useStockForecast(page, 20, 90);

  const forecastRows: TableRecord[] = stockForecast.records.map((row) => ({
    id: String(row.productId),
    name: row.sku || `Product ${row.productId}`,
    status: row.reorderWithinLeadTime ? "reorder" : "watch",
    metricA: row.currentStockQty,
    metricB: row.avgDailyUsage,
    meta: row.projectedStockoutDate ? `Stockout: ${row.projectedStockoutDate}` : "No projected stockout"
  }));

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
      <LoadStateBlock
        isLoading={stockForecast.isLoading}
        error={stockForecast.error}
        empty={!stockForecast.isLoading && !stockForecast.error && stockForecast.records.length === 0}
      />
      {!stockForecast.isLoading && !stockForecast.error ? (
        <DataTablePanel
          title="Stock Reorder Forecast (90 day lead time)"
          rows={forecastRows}
          page={stockForecast.page}
          pageSize={stockForecast.pageSize}
          totalCount={stockForecast.totalCount}
          onPageChange={setPage}
          metricBAsCurrency={false}
        />
      ) : null}
    </Stack>
  );
}

export default ForecastPage;
