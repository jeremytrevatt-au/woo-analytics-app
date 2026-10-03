import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  listJourneys,
  MalformedJourneyResponseError,
} from "../api/journeyApi";
import VisitorJourneyPanel from "../components/VisitorJourneyPanel";
import {
  JourneyLinkage,
  JourneyListResponse,
  JourneyProfile,
  JourneySort,
  JourneyStage,
} from "../types/journey";

const PER_PAGE = 25;
const EMPTY_RESULT: JourneyListResponse = {
  items: [],
  page: 1,
  per_page: PER_PAGE,
  total: 0,
};

const STAGES: JourneyStage[] = [
  "unengaged",
  "exploring",
  "considering",
  "cart_intent",
  "checkout_intent",
  "converted",
];

export default function VisitorJourneysPage() {
  const [stage, setStage] = useState<JourneyStage | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [activeWithinHours, setActiveWithinHours] = useState<number | "all">("all");
  const [linkage, setLinkage] = useState<JourneyLinkage>("all");
  const [sort, setSort] = useState<JourneySort>("score_desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<JourneyListResponse>(EMPTY_RESULT);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const resetView = () => {
    setPage(1);
    setSelectedVisitorId(null);
  };

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const response = await listJourneys({
        stage: stage === "all" ? undefined : stage,
        minScore,
        activeWithinHours: activeWithinHours === "all" ? undefined : activeWithinHours,
        linkage,
        sort,
        page,
        perPage: PER_PAGE,
      });
      if (requestId !== requestSequence.current) return;
      setResult(response);
      setSelectedVisitorId((current) => (
        response.items.some((item) => item.visitor_id === current) ? current : null
      ));
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(formatError(loadError));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [activeWithinHours, linkage, minScore, page, sort, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.per_page));

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h4" fontWeight={700}>Visitor Journeys</Typography>
          <Chip size="small" color="info" variant="outlined" label="Observation only" />
        </Stack>
        <Typography color="text.secondary">
          Ranked, read-only visitor intent signals for operational context.
        </Typography>
      </Box>

      <Alert severity="info">
        Journey observations summarise site activity to help operators understand context.
        They do not trigger automated decisions, offers, or customer contact. Identifiers are
        shown only when already linked by the analytics service.
      </Alert>

      <Paper variant="outlined">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(5, minmax(150px, 1fr))",
            },
            gap: 2,
            p: 2,
          }}
        >
          <FilterSelect
            label="Stage"
            value={stage}
            onChange={(value) => {
              setStage(value as JourneyStage | "all");
              resetView();
            }}
            options={[
              { value: "all", label: "All stages" },
              ...STAGES.map((value) => ({ value, label: formatLabel(value) })),
            ]}
          />
          <TextField
            size="small"
            type="number"
            label="Minimum score"
            value={minScore}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            onChange={(event) => {
              const value = Number(event.target.value);
              setMinScore(
                Number.isFinite(value)
                  ? Math.min(100, Math.max(0, Math.trunc(value)))
                  : 0,
              );
              resetView();
            }}
          />
          <FilterSelect
            label="Activity period"
            value={String(activeWithinHours)}
            onChange={(value) => {
              setActiveWithinHours(value === "all" ? "all" : Number(value));
              resetView();
            }}
            options={[
              { value: "all", label: "Any activity time" },
              { value: "24", label: "Last 24 hours" },
              { value: "72", label: "Last 3 days" },
              { value: "168", label: "Last 7 days" },
              { value: "720", label: "Last 30 days" },
            ]}
          />
          <FilterSelect
            label="Linkage"
            value={linkage}
            onChange={(value) => {
              setLinkage(value as JourneyLinkage);
              resetView();
            }}
            options={[
              { value: "all", label: "All linkage" },
              { value: "customer", label: "Customer linked" },
              { value: "cart", label: "Cart linked" },
              { value: "unlinked", label: "Unlinked" },
            ]}
          />
          <FilterSelect
            label="Sorting"
            value={sort}
            onChange={(value) => {
              setSort(value as JourneySort);
              resetView();
            }}
            options={[
              { value: "score_desc", label: "Highest score" },
              { value: "recent_desc", label: "Most recent" },
            ]}
          />
        </Box>

        {error ? <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert> : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: "minmax(520px, 1.15fr) minmax(380px, 0.85fr)",
            },
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              borderRight: { xs: 0, lg: 1 },
              borderBottom: { xs: 1, lg: 0 },
              borderColor: "divider",
            }}
          >
            {loading ? (
              <Stack alignItems="center" py={8}><CircularProgress /></Stack>
            ) : (
              <JourneyTable
                items={result.items}
                selectedVisitorId={selectedVisitorId}
                onSelect={setSelectedVisitorId}
              />
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              gap={1}
              sx={{ p: 2 }}
            >
              <Typography variant="body2" color="text.secondary">
                {result.total} journey{result.total === 1 ? "" : "s"}
              </Typography>
              <Pagination
                count={totalPages}
                page={Math.min(page, totalPages)}
                onChange={(_, value) => {
                  setPage(value);
                  setSelectedVisitorId(null);
                }}
                disabled={loading}
                size="small"
              />
            </Stack>
          </Box>

          <Box sx={{ minWidth: 0, p: 2 }}>
            {selectedVisitorId ? (
              <VisitorJourneyPanel
                key={selectedVisitorId}
                visitorId={selectedVisitorId}
                defaultExpanded
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{ p: 4, minHeight: 220, display: "grid", placeItems: "center" }}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Select a visitor journey</Typography>
                  <Typography color="text.secondary">
                    Choose a ranked result to load its recorded journey timeline.
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Paper>
    </Stack>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const labelId = `${label.toLowerCase().replaceAll(" ", "-")}-filter-label`;
  return (
    <FormControl size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(event) => onChange(String(event.target.value))}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function JourneyTable({
  items,
  selectedVisitorId,
  onSelect,
}: {
  items: JourneyProfile[];
  selectedVisitorId: string | null;
  onSelect: (visitorId: string) => void;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label="Ranked visitor journeys">
        <TableHead>
          <TableRow>
            <TableCell>Stage</TableCell>
            <TableCell align="right">Score</TableCell>
            <TableCell>Confidence</TableCell>
            <TableCell>Last activity</TableCell>
            <TableCell>Context</TableCell>
            <TableCell>Linkage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((journey) => (
            <TableRow
              key={journey.visitor_id}
              selected={journey.visitor_id === selectedVisitorId}
              hover
              tabIndex={0}
              aria-selected={journey.visitor_id === selectedVisitorId}
              aria-label={`Visitor journey ${journey.visitor_id}`}
              onClick={() => onSelect(journey.visitor_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(journey.visitor_id);
                }
              }}
              sx={{ cursor: "pointer" }}
            >
              <TableCell><Chip size="small" label={formatLabel(journey.stage)} /></TableCell>
              <TableCell align="right">{formatNumber(journey.score)}</TableCell>
              <TableCell>{formatLabel(journey.confidence)}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(journey.last_seen_at)}</TableCell>
              <TableCell>{formatContext(journey)}</TableCell>
              <TableCell>{formatLinkage(journey)}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography color="text.secondary" sx={{ py: 3 }}>
                  No visitor journeys match these filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}

function formatError(error: unknown): string {
  if (error instanceof MalformedJourneyResponseError) {
    return "Journey results could not be displayed because the API response was incomplete or malformed.";
  }
  return error instanceof Error ? error.message : String(error);
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}

function formatContext(journey: JourneyProfile): string {
  return journey.last_object_id === null || journey.last_object_id === undefined
    ? formatLabel(journey.last_context)
    : `${formatLabel(journey.last_context)} #${journey.last_object_id}`;
}

function formatLinkage(journey: JourneyProfile): string {
  const links = [];
  if (journey.customer_id !== null && journey.customer_id !== undefined) {
    links.push(`Customer #${journey.customer_id}`);
  }
  if (journey.cart_id) links.push(`Cart ${journey.cart_id}`);
  return links.length ? links.join(" · ") : "Unlinked";
}
