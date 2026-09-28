export type CartStatus = "active" | "empty" | "checkout_started" | "converted";
export type CartStatusFilter = CartStatus | "abandoned";

export type CartLine = {
  id?: number;
  product_id: number;
  variation_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_total: number;
  line_subtotal: number;
  line_total: number;
  metadata: Record<string, unknown>;
};

export type CartSnapshot = {
  cart_id: string;
  visitor_id: string;
  customer_id?: number | null;
  customer_analytics_key?: string | null;
  is_marketing_eligible: boolean;
  sequence: number;
  status: CartStatus;
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  created_at?: string;
  updated_at: string;
  currency: string;
  item_count: number;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  cart_hash?: string;
  order_id: number | null;
  is_abandoned?: boolean;
  abandoned_at?: string | null;
  is_recovery_eligible?: boolean;
  recovery_eligible_at?: string | null;
  lines?: CartLine[];
};

export type AuthoritativeCart = CartSnapshot & {
  lines: CartLine[];
};

export type CartListResponse = {
  items: CartSnapshot[];
  page: number;
  per_page: number;
  total: number;
};

export type CartSummary = {
  total: number;
  active: number;
  checkout_started: number;
  abandoned: number;
  recovery_eligible: number;
  recovery_value: number;
};
