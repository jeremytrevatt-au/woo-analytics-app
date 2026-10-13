import { fetchJson } from "./httpClient";

export type AdditionalShippingQuote = {
  carrier_id?: string | null;
  product_id?: string | null;
  courier_type?: string | null;
  service_level?: string | null;
  price?: number | null;
  total_cost?: number | null;
};

export type AdditionalShippingPreview = {
  order_id: number;
  paid_shipping: number;
  new_shipping: number;
  difference: number;
  paid_shipping_display: string;
  new_shipping_display: string;
  difference_display: string;
  show_action: boolean;
  billing_email: string;
  payment_state: string;
};

export type AdditionalShippingOrder = {
  order_id: number;
  additional_order_id: number;
  difference: number;
  difference_display: string;
  reused: boolean;
  payment_state: string;
};

export type AdditionalShippingSendResult = {
  order_id: number;
  additional_order_id: number;
  difference: number;
  template_id: number;
  sent: boolean;
};

export function previewAdditionalShipping(orderId: number, quote: AdditionalShippingQuote): Promise<AdditionalShippingPreview> {
  return fetchJson<AdditionalShippingPreview>(`/api/v1/packing/orders/${orderId}/additional-shipping/preview`, {
    method: "POST",
    body: JSON.stringify(quote),
  });
}

export function createAdditionalShipping(orderId: number, quote: AdditionalShippingQuote): Promise<AdditionalShippingOrder> {
  return fetchJson<AdditionalShippingOrder>(`/api/v1/packing/orders/${orderId}/additional-shipping`, {
    method: "POST",
    body: JSON.stringify(quote),
  });
}

export function sendAdditionalShippingEmail(orderId: number, confirmSend: boolean): Promise<AdditionalShippingSendResult> {
  return fetchJson<AdditionalShippingSendResult>(`/api/v1/packing/orders/${orderId}/additional-shipping/send`, {
    method: "POST",
    body: JSON.stringify({ confirm_send: confirmSend }),
  });
}
