import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  getCart,
  getLatestCustomerCart,
  getLatestVisitorCart,
} from "../api/cartsApi";
import {
  cartAbandonmentLabel,
  cartIdentityLabel,
  cartMarketingLabel,
  cartRecoveryLabel,
  cartSnapshotAge,
  cartSnapshotTimestamp,
  isCartSnapshotStale,
  STALE_CART_SNAPSHOT_MINUTES,
} from "../lib/cartPresentation";
import { AuthoritativeCart, CartSnapshot } from "../types/cart";

type Props = {
  cartId?: string | null;
  visitorId?: string | null;
  customerId?: number | null;
  title?: string;
  analysisSnapshot?: CartSnapshot | null;
};

export default function CartDetail({
  cartId,
  visitorId,
  customerId,
  title = "Cart details",
  analysisSnapshot,
}: Props) {
  const [cart, setCart] = useState<AuthoritativeCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCart(null);
    setError(null);
    setLoading(false);

    const request = cartId
      ? getCart(cartId)
      : visitorId
        ? getLatestVisitorCart(visitorId)
        : customerId
          ? getLatestCustomerCart(customerId)
          : null;

    if (!request) {
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void request
      .then((response) => {
        if (active) {
          setCart(response);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : String(requestError),
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [cartId, visitorId, customerId]);

  if (!cartId && !visitorId && !customerId) {
    return (
      <Alert severity="info">
        No cart, visitor, or WooCommerce customer identity is available.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" py={2}>
        <CircularProgress size={22} />
        <Typography variant="body2">Loading authoritative cart…</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!cart) {
    return null;
  }

  const stateSnapshot = analysisSnapshot ?? cart;
  const stale = isCartSnapshotStale(stateSnapshot);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
            {cart.cart_id}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} gap={3} flexWrap="wrap">
          <CartValue label="Status" value={formatStatus(cart.status)} />
          <CartValue label="Identity" value={cartIdentityLabel(cart)} />
          <CartValue label="Marketing" value={cartMarketingLabel(cart)} />
          <CartValue label="Items" value={String(cart.item_count)} />
          <CartValue label="Total" value={formatMoney(cart.total, cart.currency)} />
          <CartValue label="Snapshot age" value={cartSnapshotAge(stateSnapshot)} />
          <CartValue label="Order" value={cart.order_id ? `#${cart.order_id}` : "Not converted"} />
        </Stack>
        {stale ? (
          <Alert severity="warning">
            Stale snapshot: {formatDate(cartSnapshotTimestamp(stateSnapshot))} (
            older than {STALE_CART_SNAPSHOT_MINUTES} minutes).
          </Alert>
        ) : null}
        <Stack direction={{ xs: "column", sm: "row" }} gap={3}>
          <CartValue label="Abandonment" value={cartAbandonmentLabel(stateSnapshot)} />
          <CartValue label="Recovery" value={cartRecoveryLabel(stateSnapshot)} />
          <CartValue label="Visitor ID" value={cart.visitor_id} />
        </Stack>
        <Divider />
        <Table size="small" aria-label="Cart line items">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Unit total</TableCell>
              <TableCell align="right">Line total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cart.lines.map((line, index) => (
              <TableRow key={line.id ?? `${line.product_id}-${line.variation_id}-${index}`}>
                <TableCell>{line.product_name}</TableCell>
                <TableCell>{line.sku || "—"}</TableCell>
                <TableCell align="right">{line.quantity}</TableCell>
                <TableCell align="right">{formatMoney(line.unit_total, cart.currency)}</TableCell>
                <TableCell align="right">{formatMoney(line.line_total, cart.currency)}</TableCell>
              </TableRow>
            ))}
            {cart.lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">This cart has no line items.</Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <Stack direction={{ xs: "column", sm: "row" }} gap={3}>
          <CartValue label="Subtotal" value={formatMoney(cart.subtotal, cart.currency)} />
          <CartValue label="Discount" value={formatMoney(cart.discount_total, cart.currency)} />
          <CartValue label="Shipping" value={formatMoney(cart.shipping_total, cart.currency)} />
          <CartValue label="Tax" value={formatMoney(cart.tax_total, cart.currency)} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function CartValue({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "AUD",
  }).format(Number(value));
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}
