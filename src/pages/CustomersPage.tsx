import { Stack, Typography } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";

function CustomersPage() {
  const { kpis, trends, rows, isLoading, error } = useDashboardData();
  const customerKpi = kpis.find((item) => item.id === "customers");

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Customers
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Review customer activity, repeat purchase behavior, and order value.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error ? (
        <>
          <KpiGrid cards={customerKpi ? [customerKpi] : []} />
          <TrendsChartPanel title="Customer Trend" data={trends} />
          <DataTablePanel title="Customer Segments" rows={rows} />
        </>
      ) : null}
    </Stack>
  );
}

export default CustomersPage;
