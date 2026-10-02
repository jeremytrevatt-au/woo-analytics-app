import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useCallback, useEffect, useState } from "react";
import {
  getCartsSummary,
  getCartAbandonmentAnalysis,
  listCartRecoveryCandidates,
  listCarts,
} from "../api/cartsApi";
import CartDetail from "../components/CartDetail";
import {
  cartAbandonmentLabel,
  cartIdentityLabel,
  cartSnapshotAge,
  isCartSnapshotStale,
} from "../lib/cartPresentation";
import {
  CartAbandonmentAnalysis,
  CartAnalysisBreakdown,
  CartListResponse,
  CartSnapshot,
  CartStatusFilter,
  CartSummary,
} from "../types/cart";

const PER_PAGE = 25;
const emptyList: CartListResponse = {
  items: [],
  page: 1,
  per_page: PER_PAGE,
  total: 0,
};

type View = "carts" | "recovery";

export default function CartsPage() {
  const [view, setView] = useState<View>("carts");
  const [status, setStatus] = useState<CartStatusFilter | "all">("all");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [analysis, setAnalysis] = useState<CartAbandonmentAnalysis | null>(null);
  const [result, setResult] = useState<CartListResponse>(emptyList);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, listResponse] = await Promise.all([
        getCartsSummary(),
        view === "recovery"
          ? listCartRecoveryCandidates({ page, perPage: PER_PAGE })
          : listCarts({
              status: status === "all" ? undefined : status,
              page,
              perPage: PER_PAGE,
            }),
      ]);
      setSummary(summaryResponse);
      setResult(listResponse);
      setSelectedCartId((current) => (
        listResponse.items.some((item) => item.cart_id === current)
          ? current
          : null
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, status, view]);

  const loadAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      setAnalysis(await getCartAbandonmentAnalysis());
    } catch (loadError) {
      setAnalysisError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.per_page));

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Active & Abandoned Carts</Typography>
          <Typography color="text.secondary">
            Operational cart analysis with authoritative WordPress detail on demand.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => {
            void load();
            void loadAnalysis();
          }}
          disabled={loading || analysisLoading}
        >
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(7, 1fr)" },
          gap: 2,
        }}
      >
        <SummaryCard label="All carts" value={summary?.total} />
        <SummaryCard label="Active" value={summary?.active} />
        <SummaryCard label="Checkout started" value={summary?.checkout_started} />
        <SummaryCard label="Abandoned" value={summary?.abandoned} />
        <SummaryCard label="Recovery eligible" value={summary?.recovery_eligible} />
        <SummaryCard
          label="Suspected automation"
          value={summary?.suspected_automation}
        />
        <SummaryCard
          label="Recovery value"
          value={summary ? formatMoney(summary.recovery_value, "AUD") : undefined}
        />
      </Box>

      <AbandonmentAnalysisSection
        analysis={analysis}
        loading={analysisLoading}
        error={analysisError}
      />

      <Paper variant="outlined">
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          gap={2}
          sx={{ p: 2 }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: View | null) => {
              if (value) {
                setView(value);
                setPage(1);
                setSelectedCartId(null);
              }
            }}
          >
            <ToggleButton value="carts">All carts</ToggleButton>
            <ToggleButton value="recovery">Recovery candidates</ToggleButton>
          </ToggleButtonGroup>
          {view === "carts" ? (
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel id="cart-status-filter-label">Status</InputLabel>
              <Select
                labelId="cart-status-filter-label"
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as CartStatusFilter | "all");
                  setPage(1);
                  setSelectedCartId(null);
                }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="checkout_started">Checkout started</MenuItem>
                <MenuItem value="abandoned">Abandoned</MenuItem>
                <MenuItem value="suspected_automation">Suspected automation</MenuItem>
                <MenuItem value="empty">Empty</MenuItem>
                <MenuItem value="converted">Converted</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Carts eligible for customer recovery contact
            </Typography>
          )}
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(360px, 0.9fr) minmax(0, 1.4fr)" },
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              borderRight: { xs: 0, md: 1 },
              borderBottom: { xs: 1, md: 0 },
              borderColor: "divider",
            }}
          >
            {loading ? (
              <Stack alignItems="center" py={6}><CircularProgress /></Stack>
            ) : (
              <CartTable
                items={result.items}
                selectedCartId={selectedCartId}
                onSelect={setSelectedCartId}
              />
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {result.total} cart{result.total === 1 ? "" : "s"}
              </Typography>
              <Pagination
                count={totalPages}
                page={Math.min(page, totalPages)}
                onChange={(_, value) => {
                  setPage(value);
                  setSelectedCartId(null);
                }}
                disabled={loading}
                size="small"
              />
            </Stack>
          </Box>
          <Box sx={{ minWidth: 0, p: 2 }}>
            {selectedCartId ? (
              <CartDetail
                cartId={selectedCartId}
                analysisSnapshot={
                  result.items.find((item) => item.cart_id === selectedCartId) ?? null
                }
                title="Authoritative WordPress cart"
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{ p: 4, minHeight: 220, display: "grid", placeItems: "center" }}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Select a cart</Typography>
                  <Typography color="text.secondary">
                    Choose a result to load its authoritative WordPress detail.
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={700}>{value ?? "—"}</Typography>
    </Paper>
  );
}

function CartTable({
  items,
  selectedCartId,
  onSelect,
}: {
  items: CartSnapshot[];
  selectedCartId: string | null;
  onSelect: (cartId: string) => void;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Identity</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Items</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell>Abandonment</TableCell>
            <TableCell>Snapshot</TableCell>
            <TableCell>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((cart) => (
            <TableRow
              key={cart.cart_id}
              selected={selectedCartId === cart.cart_id}
              hover
              tabIndex={0}
              aria-selected={selectedCartId === cart.cart_id}
              aria-label={`Cart for ${cartIdentityLabel(cart)}`}
              onClick={() => onSelect(cart.cart_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(cart.cart_id);
                }
              }}
              sx={{ cursor: "pointer" }}
            >
              <TableCell>{cartIdentityLabel(cart)}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={
                    cart.is_suspected_automation
                      ? "error"
                      : cart.is_abandoned
                        ? "warning"
                        : "default"
                  }
                  label={
                    cart.is_suspected_automation
                      ? "suspected automation"
                      : cart.is_abandoned
                        ? "abandoned"
                        : formatStatus(cart.status)
                  }
                />
              </TableCell>
              <TableCell align="right">{cart.item_count}</TableCell>
              <TableCell align="right">{formatMoney(cart.total, cart.currency)}</TableCell>
              <TableCell>{cartAbandonmentLabel(cart)}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={isCartSnapshotStale(cart) ? "warning" : "success"}
                  label={
                    isCartSnapshotStale(cart)
                      ? `Stale · ${cartSnapshotAge(cart)}`
                      : `Current · ${cartSnapshotAge(cart)}`
                  }
                />
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(cart.cart_id);
                  }}
                >
                  {selectedCartId === cart.cart_id ? "Selected" : "View"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  No carts match this view.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}

function AbandonmentAnalysisSection({
  analysis,
  loading,
  error,
}: {
  analysis: CartAbandonmentAnalysis | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box>
          <Typography variant="h6">Abandonment analysis</Typography>
          <Typography variant="body2" color="text.secondary">
            Operational abandoned carts, excluding suspected automation.
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1} py={2}>
            <CircularProgress size={22} />
            <Typography variant="body2">Loading abandonment analysis…</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="warning">{error}</Alert>
        ) : analysis ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <AnalysisTotal
                label="Abandoned carts"
                value={String(analysis.summary.cart_count)}
              />
              <AnalysisTotal
                label="Abandoned value"
                value={formatMoney(analysis.summary.cart_value, "AUD")}
              />
              <AnalysisTotal
                label="Observed abandonment rate"
                value={formatRate(analysis.summary.abandonment_rate)}
              />
              <AnalysisTotal
                label="Completed carts in comparison"
                value={String(analysis.summary.converted_cart_count ?? 0)}
              />
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              <AnalysisBreakdown
                title="Lifecycle stage"
                rows={analysis.lifecycle_stages.map((row) => ({
                  label: formatStatus(row.lifecycle_stage),
                  values: row,
                }))}
              />
              <AnalysisBreakdown
                title="Last normalized location"
                rows={analysis.last_location_contexts.map((row) => ({
                  label: formatStatus(row.context),
                  values: row,
                }))}
              />
              <AnalysisBreakdown
                title="Value bands"
                rows={analysis.value_bands.map((row) => ({
                  label: formatValueBand(row.value_band),
                  values: row,
                }))}
              />
              <AnalysisBreakdown
                title="Top abandoned products"
                rows={analysis.top_products.map((row) => ({
                  label: row.name || row.sku || `Product #${row.product_id}`,
                  values: row,
                  detail: `${row.item_count} item${row.item_count === 1 ? "" : "s"}`,
                }))}
              />
            </Box>
          </Stack>
        ) : (
          <Typography color="text.secondary">No abandonment analysis is available.</Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function AnalysisTotal({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}

function AnalysisBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    values: CartAnalysisBreakdown;
    detail?: string;
  }>;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" mb={0.5}>{title}</Typography>
      {rows.length ? rows.map((row) => (
        <Stack
          key={row.label}
          direction="row"
          justifyContent="space-between"
          gap={2}
          py={0.5}
        >
          <Box minWidth={0}>
            <Typography variant="body2" noWrap title={row.label}>{row.label}</Typography>
            {row.detail ? (
              <Typography variant="caption" color="text.secondary">{row.detail}</Typography>
            ) : null}
          </Box>
          <Typography variant="body2" color="text.secondary" whiteSpace="nowrap">
            {row.values.cart_count} abandoned
            {row.values.abandonment_rate !== undefined
              ? ` · ${formatRate(row.values.abandonment_rate)}`
              : ""}
            {` · ${formatMoney(row.values.cart_value, "AUD")}`}
          </Typography>
        </Stack>
      )) : (
        <Typography variant="body2" color="text.secondary">No data</Typography>
      )}
    </Box>
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "AUD",
  }).format(Number(value));
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function formatValueBand(value: string): string {
  const labels: Record<string, string> = {
    under_50: "Under $50",
    "50_to_99": "$50–$99",
    "100_to_199": "$100–$199",
    "200_and_over": "$200 and over",
  };
  return labels[value] ?? formatStatus(value);
}

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "No completed outcomes";
  }
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number(value));
}
