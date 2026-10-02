import { describe, expect, it } from "vitest";
import {
  cartAbandonmentLabel,
  cartIdentityLabel,
  cartMarketingLabel,
  cartRecoveryLabel,
  cartSnapshotAge,
  isCartSnapshotStale,
} from "./cartPresentation";
import { CartSnapshot } from "../types/cart";

const snapshot: CartSnapshot = {
  cart_id: "11111111-2222-4333-8444-555555555555",
  visitor_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  customer_analytics_key: "a".repeat(64),
  is_marketing_eligible: true,
  sequence: 1,
  status: "active",
  occurred_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T12:00:00Z",
  currency: "AUD",
  item_count: 1,
  subtotal: 10,
  discount_total: 0,
  shipping_total: 0,
  tax_total: 1,
  total: 11,
  order_id: null,
  is_abandoned: true,
  abandoned_at: "2026-09-28T11:00:00Z",
  is_recovery_eligible: true,
  recovery_eligible_at: "2026-09-28T12:00:00Z",
};

describe("cartPresentation", () => {
  it("presents identity and explicit marketing state", () => {
    expect(cartIdentityLabel(snapshot)).toBe("Identified customer");
    expect(cartMarketingLabel(snapshot)).toBe("Marketing eligible");
    expect(cartMarketingLabel({
      ...snapshot,
      is_marketing_eligible: false,
    })).toBe("Not marketing eligible");
  });

  it("uses occurred_at rather than projection updated_at for staleness", () => {
    const now = Date.parse("2026-09-28T12:01:00Z");
    expect(isCartSnapshotStale(snapshot, now)).toBe(true);
    expect(cartSnapshotAge(snapshot, now)).toBe("2h old");
  });

  it("presents abandonment and recovery classification explicitly", () => {
    expect(cartAbandonmentLabel(snapshot)).toMatch(/^Abandoned /);
    expect(cartRecoveryLabel(snapshot)).toMatch(/^Recovery eligible /);
    expect(cartAbandonmentLabel({
      ...snapshot,
      is_abandoned: undefined,
    })).toBe("Not classified");
  });

  it("uses backend recovery reasons and safely derives legacy reasons", () => {
    expect(cartRecoveryLabel({
      ...snapshot,
      is_recovery_eligible: false,
      recovery_contact_basis: "none",
      recovery_ineligibility_reasons: ["policy", "time"],
    })).toBe(
      "Recovery ineligible · No explicit consent or existing customer relationship; Recovery waiting period has not elapsed",
    );

    expect(cartRecoveryLabel({
      ...snapshot,
      is_recovery_eligible: false,
      recovery_contact_basis: undefined,
      is_marketing_eligible: false,
      customer_analytics_key: null,
    })).toContain("No identified customer");
  });
});
