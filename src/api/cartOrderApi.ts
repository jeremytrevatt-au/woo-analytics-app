import { fetchJson } from "./httpClient";

export type CartOrderAddress = {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
};

export type CartOrderCreatePayload = {
  coupon_code?: string;
  custom_shipping_inclusive?: number;
  confirm_already_converted?: boolean;
  deliver_via_chat?: boolean;
  conversation_id?: string;
  visitor_id?: string;
  customer_id?: number;
  billing?: CartOrderAddress;
  shipping?: CartOrderAddress;
};

export type CartOrderCreateResponse = {
  order_id: number;
  order_number: string;
  status: string;
  needs_payment: boolean;
  currency: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  fee_total: number;
  tax_total: number;
  total: number;
  coupon_codes: string[];
  payment_url: string;
  admin_edit_url: string;
  cart_id: string;
  created_via: string;
  fulfillment_excluded: boolean;
  stock_reduced_on_create: boolean;
  delivery_message: string;
  hold_stock_minutes?: number;
  chat_delivery: {
    status: "delivered" | "unavailable" | "failed" | "not_requested";
    reason?: string | null;
    upstream_status_code?: string | null;
  };
};

export function createCartOrder(
  cartId: string,
  payload: CartOrderCreatePayload,
  idempotencyKey: string,
): Promise<CartOrderCreateResponse> {
  return fetchJson<CartOrderCreateResponse>(
    `/api/v1/carts/${encodeURIComponent(cartId)}/orders`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    },
  );
}
