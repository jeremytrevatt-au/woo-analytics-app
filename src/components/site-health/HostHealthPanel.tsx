import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { HostHealthReport } from "../../api/siteHealthApi";
import HealthStatusChip from "./HealthStatusChip";

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not reported";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "Not reportable";
}

export default function HostHealthPanel({ report }: { report: HostHealthReport }) {
  if (report.status === "unavailable" || !report.summary || !report.checks) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>Host health</Typography>
          <Alert severity="warning">
            {report.error || "The host collector report is unavailable."}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Source: {report.source?.instance_name || "not reported"}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">Host health</Typography>
            <Typography variant="body2" color="text.secondary">
              Read-only machine, runtime, service, log and code-manifest diagnostics from Cloud Logging.
            </Typography>
          </Box>
          <HealthStatusChip status={report.summary.status} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
          Scan {report.scan_id || "not reported"} · {report.generated_at
            ? new Date(report.generated_at).toLocaleString()
            : "time not reported"} · source {report.source?.instance_name || "not reported"}
        </Typography>
        {report.checks.map((healthCheck) => (
          <Accordion key={healthCheck.id} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                <HealthStatusChip status={healthCheck.status} />
                <Typography fontWeight={600}>{healthCheck.title}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {healthCheck.id}</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Observed:</strong> {display(healthCheck.observed)}</Typography>
                <Typography variant="body2"><strong>Expected:</strong> {display(healthCheck.expected)}</Typography>
                <Typography variant="body2"><strong>Recommendation:</strong> {healthCheck.recommendation}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}
