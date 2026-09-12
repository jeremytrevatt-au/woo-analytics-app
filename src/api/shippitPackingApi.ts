import { fetchJson } from "./httpClient";

export type PackingQuoteParcel = {
  qty: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type PackingQuoteResponse = {
  name: string;
  method: string;
  url: string;
  status_code: number;
  duration_ms: number;
  body: unknown;
};

export async function previewPackingQuote(orderId: number, parcels: PackingQuoteParcel[]): Promise<PackingQuoteResponse> {
  return fetchJson<PackingQuoteResponse>("/api/v1/shippit/packing/quote", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      parcels,
    }),
  });
}
