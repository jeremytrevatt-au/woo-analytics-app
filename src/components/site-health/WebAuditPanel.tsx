import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  AuditCategory,
  CollectorStatus,
  CruxRecord,
  AuditStrategy,
  PsiCollector,
  RunWebAuditRequest,
  WebAuditRecord,
} from "../../api/siteHealthApi";

const categoryOptions: Array<{ value: AuditCategory; label: string }> = [
  { value: "performance", label: "Performance" },
  { value: "accessibility", label: "Accessibility" },
  { value: "best-practices", label: "Best practices" },
  { value: "seo", label: "SEO" },
];

interface Props {
  url: string;
  strategy: AuditStrategy;
  categories: AuditCategory[];
  running: boolean;
  result: WebAuditRecord | null;
  onUrlChange: (url: string) => void;
  onStrategyChange: (strategy: AuditStrategy) => void;
  onCategoriesChange: (categories: AuditCategory[]) => void;
  onRun: (payload: RunWebAuditRequest) => void;
}

function hasData(status: CollectorStatus): boolean {
  return status === "available" || status === "partial";
}

function formatScore(score: number | null): string {
  if (score === null) return "Not reported";
  return `${Math.round(score <= 1 ? score * 100 : score)}`;
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "object") {
    const metric = value as Record<string, unknown>;
    if (metric.display_value) return String(metric.display_value);
    if (metric.value !== undefined) return `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
    return JSON.stringify(value);
  }
  return String(value);
}

function StatusMessage({ name, status, error }: { name: string; status: CollectorStatus; error?: string | null }) {
  return (
    <Alert severity={status === "error" ? "error" : status === "partial" ? "warning" : "info"}>
      {name} status: {status.replaceAll("_", " ")}
      {error ? ` — ${error}` : ""}
    </Alert>
  );
}

function PsiResults({ psi }: { psi: PsiCollector }) {
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <StatusMessage name="PageSpeed Insights" status={psi.status} error={psi.error} />
      {psi.document_status && psi.document_status.score !== 1 ? (
        <Alert severity="warning">
          Lighthouse did not confirm a successful page response. This can indicate an authentication challenge,
          HTTP error, or runtime failure; category scores must not be treated as storefront health.
        </Alert>
      ) : null}
      {psi.requested_url || psi.final_url ? (
        <Typography variant="body2" color="text.secondary">
          Requested URL: {psi.requested_url ?? "Not reported"} · Final URL: {psi.final_url ?? "Not reported"}
        </Typography>
      ) : null}
      {psi.runtime_error ? (
        <Alert severity="error">Lighthouse runtime error: {valueText(psi.runtime_error)}</Alert>
      ) : null}
      {hasData(psi.status) ? (
        <>
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={3}>
            {Object.entries(psi.categories ?? {}).map(([name, category]) => category ? (
              <Box key={name}>
                <Typography variant="caption" color="text.secondary">{category.title}</Typography>
                <Typography variant="h5">{formatScore(category.score)}</Typography>
              </Box>
            ) : null)}
          </Stack>
          <Box>
            <Typography variant="subtitle2">Lighthouse lab metrics</Typography>
            {Object.entries(psi.lab_metrics ?? {}).length ? Object.entries(psi.lab_metrics ?? {}).map(([name, value]) => (
              <Typography variant="body2" key={name}>{name}: <strong>{valueText(value)}</strong></Typography>
            )) : <Typography variant="body2" color="text.secondary">No lab metrics reported.</Typography>}
          </Box>
          <Box>
            <Typography variant="subtitle2">Actionable audits</Typography>
            {psi.actionable_audits?.length ? psi.actionable_audits.map((audit) => (
              <Typography variant="body2" key={audit.id}>
                {audit.title}{audit.display_value ? ` — ${audit.display_value}` : ""}
              </Typography>
            )) : <Typography variant="body2" color="text.secondary">No actionable audits reported.</Typography>}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Lighthouse {psi.lighthouse_version ?? "version not reported"} · fetched {psi.fetch_time ? new Date(psi.fetch_time).toLocaleString() : "time not reported"}
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}

function CruxRecordResults({ scope, record }: { scope: "Page" | "Origin"; record?: CruxRecord }) {
  if (!record) {
    return <Alert severity="info">{scope} CrUX record was not returned.</Alert>;
  }
  return (
    <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="subtitle2">{scope}</Typography>
      <StatusMessage name={`${scope} CrUX`} status={record.status} />
      {hasData(record.status) ? (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Collection period: {record.collection_period?.start ?? "Not reported"} to {record.collection_period?.end ?? "Not reported"}
          </Typography>
          {Object.entries(record.metrics).length ? Object.entries(record.metrics).map(([name, metric]) => (
            <Box key={name}>
              <Typography variant="body2" fontWeight={700}>{name}</Typography>
              <Typography variant="body2">Percentiles: {JSON.stringify(metric.percentiles)}</Typography>
              <Typography variant="body2">Histogram: {JSON.stringify(metric.histogram)}</Typography>
            </Box>
          )) : <Alert severity="info">No field metrics were returned for this {scope.toLowerCase()}.</Alert>}
        </Stack>
      ) : null}
    </Box>
  );
}

export default function WebAuditPanel({
  url,
  strategy,
  categories,
  running,
  result,
  onUrlChange,
  onStrategyChange,
  onCategoriesChange,
  onRun,
}: Props) {
  const toggleCategory = (category: AuditCategory) => {
    onCategoriesChange(
      categories.includes(category)
        ? categories.filter((item) => item !== category)
        : [...categories, category],
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5">Google web audit</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Lighthouse lab data is a simulated single run. CrUX field data reflects real users over the previous 28 days.
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Page URL"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            fullWidth
            type="url"
          />
          <ToggleButtonGroup
            exclusive
            value={strategy}
            onChange={(_, value: AuditStrategy | null) => value && onStrategyChange(value)}
            size="small"
            aria-label="Audit strategy"
          >
            <ToggleButton value="mobile">Mobile</ToggleButton>
            <ToggleButton value="desktop">Desktop</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" useFlexGap flexWrap="wrap">
            {categoryOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={categories.includes(option.value)}
                    onChange={() => toggleCategory(option.value)}
                  />
                }
                label={option.label}
              />
            ))}
          </Stack>
          <Box>
            <Button
              variant="contained"
              disabled={running || !url.trim() || categories.length === 0}
              onClick={() => onRun({ url: url.trim(), strategy, categories })}
            >
              {running ? <CircularProgress size={20} /> : "Run Google Audit"}
            </Button>
          </Box>
        </Stack>

        {result ? (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">Audit result</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Audit ID: {result.audit_id} · Request ID: {result.request_id} · requested {new Date(result.requested_at).toLocaleString()}
              {result.completed_at ? ` · completed ${new Date(result.completed_at).toLocaleString()}` : " · not completed"}
              {` · ${result.strategy} · ${result.status}`}
            </Typography>

            <Typography variant="subtitle1" fontWeight={700}>PageSpeed Insights / Lighthouse</Typography>
            <PsiResults psi={result.collectors.psi} />

            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3 }}>CrUX field data</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <StatusMessage name="CrUX collector" status={result.collectors.crux.status} />
              <CruxRecordResults scope="Page" record={result.collectors.crux.records?.page} />
              <CruxRecordResults scope="Origin" record={result.collectors.crux.records?.origin} />
            </Stack>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
