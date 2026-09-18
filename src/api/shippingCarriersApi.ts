import { fetchJson } from "./httpClient";

export type ShippingCarrierHealth = {
  id: string;
  label: string;
  available: boolean;
  runtime_loaded: boolean;
  credentials_configured?: boolean;
  business_entitled?: boolean;
  labels_entitled?: boolean;
  environment?: string | null;
  capabilities: string[];
  plugin_version?: string | null;
};

export type ShippingCarriersResponse = {
  carriers: ShippingCarrierHealth[];
};

export function getShippingCarriers(): Promise<ShippingCarriersResponse> {
  return fetchJson<ShippingCarriersResponse>("/api/v1/shipping/carriers");
}
