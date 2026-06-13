import { Grid, Stack, Typography } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import ForecastPanel from "../components/ForecastPanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";

function OverviewPage() {
  const { kpis, trends, rows, forecast, isLoading, error } = useDashboardData();
  const showContent = !isLoading && !error && kpis.length > 0;

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Overview
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && kpis.length === 0} />
      {showContent ? (
        <>
          <KpiGrid cards={kpis} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TrendsChartPanel title="Commerce Trends" data={trends} />
            </Grid>
            <Grid item xs={12} md={4}>
              <ForecastPanel forecast={forecast} />
            </Grid>
            <Grid item xs={12}>
              <DataTablePanel title="Top Performing Products" rows={rows} />
            </Grid>
          </Grid>
        </>
      ) : null}
    </Stack>
  );
}

export default OverviewPage;
