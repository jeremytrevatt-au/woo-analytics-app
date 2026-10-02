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
  if (cart.recovery_contact_basis === "explicit_consent") {
    return "Explicit marketing consent";
  }
  if (cart.recovery_contact_basis === "existing_customer") {
    return "Existing customer relationship";
  }
  if (cart.recovery_contact_basis === "none") {
    return "No recovery contact permission";
  }
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
  if (cart.is_recovery_eligible) {
    const eligibleLabel = cart.recovery_eligible_at
    ? `Recovery eligible ${formatTimestamp(cart.recovery_eligible_at)}`
    : "Recovery eligible";
    const basis = recoveryContactBasisLabel(cart);
    return basis ? `${eligibleLabel} · ${basis}` : eligibleLabel;
  }

  const reasons = recoveryIneligibilityReasons(cart);
  if (reasons.length > 0) {
    return `Recovery ineligible · ${reasons.join("; ")}`;
  }
  return cart.is_recovery_eligible === undefined
    ? "Recovery eligibility not classified"
    : "Recovery eligibility awaiting classification";
}

export function recoveryContactBasisLabel(cart: CartSnapshot): string | null {
  if (cart.recovery_contact_basis === "explicit_consent") {
    return "Explicit marketing consent";
  }
  if (cart.recovery_contact_basis === "existing_customer") {
    return "Existing customer relationship";
  }
  if (cart.recovery_contact_basis === "none") {
    return "No recovery contact permission";
  }
  return null;
}

function recoveryIneligibilityReasons(cart: CartSnapshot): string[] {
  const backendReasons = cart.recovery_ineligibility_reasons;
  if (backendReasons?.length) {
    return backendReasons.map((reason) => recoveryReasonLabel(reason, cart));
  }

  const reasons: string[] = [];
  if (!["active", "checkout_started"].includes(cart.status)) {
    reasons.push("Lifecycle stage is not recoverable");
  }
  if (cart.order_id !== null && cart.order_id !== undefined) {
    reasons.push("Already converted to an order");
  }
  if (cart.item_count <= 0) {
    reasons.push("Cart has no items");
  }
  if (!cart.customer_analytics_key && !cart.customer_id) {
    reasons.push("No identified customer");
  }
  if (
    cart.recovery_contact_basis === "none"
    || (
      cart.recovery_contact_basis === undefined
      && !cart.is_marketing_eligible
      && !cart.customer_id
    )
  ) {
    reasons.push("No explicit consent or existing customer relationship");
  }
  if (reasons.length === 0 && cart.is_abandoned === false) {
    reasons.push("Cart is not abandoned");
  } else if (
    reasons.length === 0
    && cart.is_abandoned
    && cart.is_recovery_eligible === false
  ) {
    reasons.push("Recovery waiting period has not elapsed");
  }
  return reasons;
}

function recoveryReasonLabel(reason: string, cart: CartSnapshot): string {
  switch (reason) {
    case "status":
      return "Lifecycle stage is not recoverable";
    case "order":
      return "Already converted to an order";
    case "items":
      return "Cart has no items";
    case "identity":
      return "No identified customer";
    case "policy":
      return cart.recovery_contact_basis === "none"
        ? "No explicit consent or existing customer relationship"
        : "Recovery contact policy is not satisfied";
    case "time":
      return "Recovery waiting period has not elapsed";
    default:
      return reason.replaceAll("_", " ");
  }
}

function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}
