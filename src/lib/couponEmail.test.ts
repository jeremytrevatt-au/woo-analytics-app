import { describe, expect, it } from "vitest";
import {
  couponDialogInvalidReason,
  couponRestrictionEmail,
  defaultCouponExpiryLocal,
  isCouponRestrictionEmail,
} from "./couponEmail";

describe("couponRestrictionEmail", () => {
  it("prefills the first valid Woo, billing, identity, or guest email", () => {
    expect(couponRestrictionEmail(
      "  ms.j.graybill@gmail.com ",
      "billing@example.test",
      "guest@example.test",
    )).toBe("ms.j.graybill@gmail.com");
    expect(couponRestrictionEmail(null, "", "guest@example.test")).toBe("guest@example.test");
    expect(couponRestrictionEmail(undefined, "not-an-email", "")).toBe("");
  });

  it("accepts the customer 2011 address", () => {
    expect(isCouponRestrictionEmail("ms.j.graybill@gmail.com")).toBe(true);
  });
});

describe("couponDialogInvalidReason", () => {
  const futureExpiry = "2099-10-04T00:00";
  const valid = {
    code: "FREESHIP",
    amount: "",
    discountType: "percent" as const,
    usageLimit: "1",
    expiresAt: futureExpiry,
    freeShipping: true,
    emailRestriction: "",
  };

  it("enables free-shipping-only coupons with a blank amount and blank or valid email", () => {
    expect(couponDialogInvalidReason(valid)).toBeNull();
    expect(couponDialogInvalidReason({
      ...valid,
      emailRestriction: "ms.j.graybill@gmail.com",
    })).toBeNull();
  });

  it("disables Create for invalid email or missing code or expiry", () => {
    expect(couponDialogInvalidReason({
      ...valid,
      emailRestriction: "not-an-email",
    })).toBe("Enter a valid email address, or leave the restriction blank.");
    expect(couponDialogInvalidReason({ ...valid, code: "" })).toBe("Enter a unique coupon code.");
    expect(couponDialogInvalidReason({ ...valid, expiresAt: "" })).toBe("Choose a future expiry time.");
    expect(couponDialogInvalidReason({
      ...valid,
      expiresAt: "2020-01-01T00:00",
      now: Date.parse("2026-10-27T03:21:00Z"),
    })).toBe("Choose a future expiry time.");
  });

  it("defaults expiry to a local future datetime", () => {
    const now = new Date("2026-10-27T03:21:00.000Z");
    const value = defaultCouponExpiryLocal(now);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(Date.parse(value)).toBeGreaterThan(now.getTime());
    expect(Math.abs(Date.parse(value) - now.getTime() - 7 * 24 * 60 * 60 * 1000)).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
