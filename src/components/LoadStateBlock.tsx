import { Alert, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";

type Props = {
  isLoading: boolean;
  error: string | null;
  empty: boolean;
};

function LoadStateBlock({ isLoading, error, empty }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2">Loading analytics data...</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (empty) {
    return <Alert severity="info">No data available for the selected filters.</Alert>;
  }

  return null;
}

export default LoadStateBlock;
