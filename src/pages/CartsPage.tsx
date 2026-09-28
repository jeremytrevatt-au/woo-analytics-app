import {
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
import { useCallback, useEffect, useState } from "react";
import {
  getCartsSummary,
  listCartRecoveryCandidates,
  listCarts,
} from "../api/cartsApi";
import CartDetail from "../components/CartDetail";
import {
  cartAbandonmentLabel,
  cartIdentityLabel,
  cartMarketingLabel,
  cartRecoveryLabel,
  cartSnapshotAge,
  isCartSnapshotStale,
} from "../lib/cartPresentation";
import {
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
  const [result, setResult] = useState<CartListResponse>(emptyList);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

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
        <Button variant="outlined" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" },
          gap: 2,
        }}
      >
        <SummaryCard label="All carts" value={summary?.total} />
        <SummaryCard label="Active" value={summary?.active} />
        <SummaryCard label="Checkout started" value={summary?.checkout_started} />
        <SummaryCard label="Abandoned" value={summary?.abandoned} />
        <SummaryCard label="Recovery eligible" value={summary?.recovery_eligible} />
        <SummaryCard
          label="Recovery value"
          value={summary ? formatMoney(summary.recovery_value, "AUD") : undefined}
        />
      </Box>

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
          />
        </Stack>
      </Paper>

      {selectedCartId ? (
        <CartDetail
          cartId={selectedCartId}
          analysisSnapshot={
            result.items.find((item) => item.cart_id === selectedCartId) ?? null
          }
          title="Authoritative WordPress cart"
        />
      ) : null}
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
            <TableCell>Cart</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Identity</TableCell>
            <TableCell>Marketing</TableCell>
            <TableCell align="right">Items</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell>Abandonment</TableCell>
            <TableCell>Recovery</TableCell>
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
            >
              <TableCell sx={{ maxWidth: 220, wordBreak: "break-all" }}>
                {cart.cart_id}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={cart.is_abandoned ? "warning" : "default"}
                  label={cart.is_abandoned ? "abandoned" : formatStatus(cart.status)}
                />
              </TableCell>
              <TableCell>{cartIdentityLabel(cart)}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={cart.is_marketing_eligible ? "success" : "default"}
                  label={cartMarketingLabel(cart)}
                />
              </TableCell>
              <TableCell align="right">{cart.item_count}</TableCell>
              <TableCell align="right">{formatMoney(cart.total, cart.currency)}</TableCell>
              <TableCell>{cartAbandonmentLabel(cart)}</TableCell>
              <TableCell>{cartRecoveryLabel(cart)}</TableCell>
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
                <Button size="small" onClick={() => onSelect(cart.cart_id)}>
                  {selectedCartId === cart.cart_id ? "Selected" : "View"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10}>
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

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "AUD",
  }).format(Number(value));
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}
