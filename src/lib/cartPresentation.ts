import { CartSnapshot } from "../types/cart";

export const STALE_CART_SNAPSHOT_MINUTES = 60;

export function cartIdentityLabel(cart: CartSnapshot): string {
  if (cart.customer_id) {
    return `Woo customer #${cart.customer_id}`;
  }
  if (cart.customer_analytics_key) {
    return "Identified customer";
  }
  return "Anonymous visitor";
}

export function cartMarketingLabel(cart: CartSnapshot): string {
  return cart.is_marketing_eligible
    ? "Marketing eligible"
    : "Not marketing eligible";
}

export function cartSnapshotTimestamp(cart: CartSnapshot): string {
  return cart.occurred_at || cart.updated_at;
}

export function isCartSnapshotStale(
  cart: CartSnapshot,
  now = Date.now(),
): boolean {
  const timestamp = Date.parse(cartSnapshotTimestamp(cart));
  return (
    Number.isFinite(timestamp)
    && now - timestamp > STALE_CART_SNAPSHOT_MINUTES * 60_000
  );
}

export function cartSnapshotAge(
  cart: CartSnapshot,
  now = Date.now(),
): string {
  const timestamp = Date.parse(cartSnapshotTimestamp(cart));
  if (!Number.isFinite(timestamp)) {
    return "Unknown age";
  }
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (elapsedMinutes < 1) {
    return "Just now";
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m old`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 48) {
    return `${elapsedHours}h old`;
  }
  return `${Math.floor(elapsedHours / 24)}d old`;
}

export function cartAbandonmentLabel(cart: CartSnapshot): string {
  if (cart.is_abandoned === undefined) {
    return "Not classified";
  }
  if (!cart.is_abandoned) {
    return "Not abandoned";
  }
  return cart.abandoned_at
    ? `Abandoned ${formatTimestamp(cart.abandoned_at)}`
    : "Abandoned";
}

export function cartRecoveryLabel(cart: CartSnapshot): string {
  if (cart.is_recovery_eligible === undefined) {
    return "Not classified";
  }
  if (!cart.is_recovery_eligible) {
    return "Not recovery eligible";
  }
  return cart.recovery_eligible_at
    ? `Recovery eligible ${formatTimestamp(cart.recovery_eligible_at)}`
    : "Recovery eligible";
}

function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}
