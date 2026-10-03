import { fetchJson } from "./httpClient";

export type CouponDiscountType = "percent" | "fixed_cart";

export type CouponCreatePayload = {
  code: string;
  discount_type: CouponDiscountType;
  amount: number;
  usage_limit: number;
  expires_at: string;
  custom_message?: string;
  customer_id?: number;
  cart_id?: string;
  visitor_id?: string;
  conversation_id?: string;
  deliver_via_chat: boolean;
};

export type CouponCreateResponse = {
  id: number;
  code: string;
  discount_type: CouponDiscountType;
  amount: number;
  usage_limit: number;
  expires_at: string;
  customer_restricted: boolean;
  delivery_message: string;
  chat_delivery: {
    status: "delivered" | "unavailable" | "failed" | "not_requested";
    reason?: string | null;
    upstream_status_code?: string | null;
  };
};

export function createCoupon(
  payload: CouponCreatePayload,
  idempotencyKey: string,
): Promise<CouponCreateResponse> {
  return fetchJson<CouponCreateResponse>("/api/v1/coupons", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}
