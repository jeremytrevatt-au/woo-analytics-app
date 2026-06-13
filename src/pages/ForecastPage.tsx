import { Stack, Typography } from "@mui/material";
import ForecastPanel from "../components/ForecastPanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";

function ForecastPage() {
  const { forecast, isLoading, error } = useDashboardData();
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
    </Stack>
  );
}

export default ForecastPage;
