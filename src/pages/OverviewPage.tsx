import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ForecastPanel from "../components/ForecastPanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";
import { useFilters } from "../hooks/useFilters";

function OverviewPage() {
  const { kpis, trends, forecast, isLoading, error } = useDashboardData("overview", 1, 20);
  const { filters, updateFilter } = useFilters();
  const showContent = !isLoading && !error && kpis.length > 0;

  return (
    <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700}>
        Overview
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && kpis.length === 0} />
      {showContent ? (
        <>
          <KpiGrid cards={kpis} />
          <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            <ToggleButtonGroup
              value={filters.granularity}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) updateFilter("granularity", value);
              }}
            >
              <ToggleButton value="day">Daily</ToggleButton>
              <ToggleButton value="week">Weekly</ToggleButton>
              <ToggleButton value="month">Monthly</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 2,
              width: "100%",
              minWidth: 0,
            }}
          >
            <TrendsChartPanel title="Commerce Trends" domain="orders" data={trends} />
            <ForecastPanel forecast={forecast} />
          </Box>
        </>
      ) : null}
    </Stack>
  );
}

export default OverviewPage;
