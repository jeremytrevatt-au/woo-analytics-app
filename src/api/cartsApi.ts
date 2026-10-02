import { fetchJson } from "./httpClient";
import {
  AuthoritativeCart,
  CartAbandonmentAnalysis,
  CartListResponse,
  CartStatusFilter,
  CartSummary,
} from "../types/cart";

export type CartListParams = {
  status?: CartStatusFilter;
  page?: number;
  perPage?: number;
};

export function listCarts({
  status,
  page = 1,
  perPage = 25,
}: CartListParams = {}): Promise<CartListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (status) {
    query.set("status", status);
  }
  return fetchJson<CartListResponse>(`/api/v1/carts?${query.toString()}`);
}

export function getCartsSummary(): Promise<CartSummary> {
  return fetchJson<CartSummary>("/api/v1/carts/summary");
}

export function getCartAbandonmentAnalysis(): Promise<CartAbandonmentAnalysis> {
  return fetchJson<CartAbandonmentAnalysis>(
    "/api/v1/carts/abandonment-analysis",
  );
}

export function listCartRecoveryCandidates({
  page = 1,
  perPage = 25,
}: Omit<CartListParams, "status"> = {}): Promise<CartListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  return fetchJson<CartListResponse>(
    `/api/v1/carts/recovery-candidates?${query.toString()}`,
  );
}

export function getCart(cartId: string): Promise<AuthoritativeCart> {
  return fetchJson<AuthoritativeCart>(
    `/api/v1/carts/${encodeURIComponent(cartId)}`,
  );
}

export function getLatestCustomerCart(
  customerId: number,
): Promise<AuthoritativeCart> {
  return fetchJson<AuthoritativeCart>(
    `/api/v1/carts/latest/customer/${encodeURIComponent(String(customerId))}`,
  );
}

export function getLatestVisitorCart(
  visitorId: string,
): Promise<AuthoritativeCart> {
  return fetchJson<AuthoritativeCart>(
    `/api/v1/carts/latest/visitor/${encodeURIComponent(visitorId)}`,
  );
}
