import { fetchJson } from "./httpClient";

export type CustomerContact = {
  customer_id: number;
  user_email: string;
  billing_email: string;
};

export function getCustomerContact(customerId: number): Promise<CustomerContact> {
  return fetchJson<CustomerContact>(`/api/v1/customers/${customerId}/contact`);
}
