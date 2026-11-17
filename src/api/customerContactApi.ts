import { fetchJson } from "./httpClient";

export type CustomerContact = {
  customer_id: number;
  user_email: string;
  billing_email: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  billing_phone?: string;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_address_1?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  shipping_phone?: string;
};

export function getCustomerContact(customerId: number): Promise<CustomerContact> {
  return fetchJson<CustomerContact>(`/api/v1/customers/${customerId}/contact`);
}
