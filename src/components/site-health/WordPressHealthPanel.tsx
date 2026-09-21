import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { WordPressHealthReport } from "../../api/siteHealthApi";
import HealthStatusChip from "./HealthStatusChip";

interface Props {
  report: WordPressHealthReport | null;
  loading: boolean;
  onRefresh: () => void;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not reported";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function WordPressHealthPanel({ report, loading, onRefresh }: Props) {
  const groupedChecks = report?.checks.reduce<Record<string, WordPressHealthReport["checks"]>>(
    (groups, check) => {
      (groups[check.category] ??= []).push(check);
      return groups;
    },
    {},
  );

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5">WordPress health</Typography>
            <Typography variant="body2" color="text.secondary">
              Authoritative checks reported by the WordPress collector.
            </Typography>
          </Box>
          <Button variant="contained" onClick={onRefresh} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "Run / Refresh WordPress Health"}
          </Button>
        </Stack>

        {report ? (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mt: 3 }}>
              <HealthStatusChip status={report.summary.status} />
              <Typography variant="body2">
                Scan <strong>{report.scan_id}</strong> · {new Date(report.generated_at).toLocaleString()} · collector {report.collector_version}
              </Typography>
            </Stack>
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} sx={{ mt: 2 }}>
              {Object.entries(report.summary.counts).map(([status, count]) => (
                <Typography variant="body2" key={status}>
                  {status.replaceAll("_", " ")}: <strong>{count}</strong>
                </Typography>
              ))}
            </Stack>
            <Box
              component="pre"
              aria-label="WordPress environment"
              sx={{ p: 2, mt: 2, bgcolor: "action.hover", borderRadius: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {displayValue(report.site)}
            </Box>
            <Divider sx={{ my: 3 }} />
            {Object.entries(groupedChecks ?? {}).map(([category, checks]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, textTransform: "capitalize" }}>
                  {category.replaceAll("_", " ")}
                </Typography>
                {checks.map((check) => (
                  <Accordion key={check.id} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                        <HealthStatusChip status={check.status} />
                        <Typography fontWeight={600}>{check.title}</Typography>
                        <Typography variant="caption" color="text.secondary">ID: {check.id}</Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <Typography variant="body2"><strong>Observed:</strong> {displayValue(check.observed)}</Typography>
                        <Typography variant="body2"><strong>Expected:</strong> {displayValue(check.expected)}</Typography>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Evidence</Typography>
                          <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" }}>
                            {displayValue(check.evidence)}
                          </Box>
                        </Box>
                        <Typography variant="body2">
                          <strong>Recommendation:</strong> {check.recommendation || "No recommendation reported."}
                        </Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ))}
          </>
        ) : (
          !loading && <Typography color="text.secondary" sx={{ mt: 3 }}>No WordPress health report loaded.</Typography>
        )}
      </CardContent>
    </Card>
  );
}
