import { Stack, Typography } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";

function StockPage() {
  const { kpis, trends, rows, isLoading, error } = useDashboardData();
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
          <TrendsChartPanel title="Stock Trend" data={trends} />
          <DataTablePanel title="Stock Snapshot" rows={rows} />
        </>
      ) : null}
    </Stack>
  );
}

export default StockPage;
