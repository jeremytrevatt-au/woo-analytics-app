export function isCouponRestrictionEmail(value: string): boolean {
  const email = value.trim();
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1 || email.includes(" ")) return false;
  return email.slice(at + 1).includes(".");
}

export function couponRestrictionEmail(
  ...sources: Array<string | null | undefined>
): string {
  for (const source of sources) {
    const email = String(source || "").trim();
    if (email && isCouponRestrictionEmail(email)) return email;
  }
  return "";
}

export function defaultCouponExpiryLocal(now = new Date()): string {
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${expires.getFullYear()}-${pad(expires.getMonth() + 1)}-${pad(expires.getDate())}T${pad(expires.getHours())}:${pad(expires.getMinutes())}`;
}

export function couponDialogInvalidReason(input: {
  code: string;
  amount: string;
  discountType: "percent" | "fixed_cart";
  usageLimit: string;
  expiresAt: string;
  freeShipping: boolean;
  emailRestriction: string;
  now?: number;
}): string | null {
  if (!input.code.trim()) return "Enter a unique coupon code.";
  const amountBlank = input.amount.trim() === "";
  const numericAmount = Number(input.amount);
  if (input.freeShipping) {
    if (!amountBlank && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
      return "Enter a discount of zero or more, or leave it blank.";
    }
    if (!amountBlank && input.discountType === "percent" && numericAmount > 100) {
      return "Percentage discounts cannot exceed 100%.";
    }
  } else if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "Enter a discount greater than zero.";
  } else if (input.discountType === "percent" && numericAmount > 100) {
    return "Percentage discounts cannot exceed 100%.";
  }
  const numericLimit = Number(input.usageLimit);
  if (!Number.isInteger(numericLimit) || numericLimit < 1) {
    return "Usage limit must be at least one.";
  }
  if (!input.expiresAt || Date.parse(input.expiresAt) <= (input.now ?? Date.now())) {
    return "Choose a future expiry time.";
  }
  const typedEmail = input.emailRestriction.trim();
  if (typedEmail && !isCouponRestrictionEmail(typedEmail)) {
    return "Enter a valid email address, or leave the restriction blank.";
  }
  return null;
}
