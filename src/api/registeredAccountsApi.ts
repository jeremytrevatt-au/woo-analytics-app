import { fetchJson } from "./httpClient";

export type RegisteredAccountAddress = {
  address_1: string;
  city: string;
  postcode: string;
  country: string;
};

export type RegisteredAccount = {
  user_id: number;
  user_login: string;
  email: string;
  display_name: string;
  registered_at: string;
  first_name: string;
  last_name: string;
  billing_address: RegisteredAccountAddress;
  shipping_address: RegisteredAccountAddress;
  is_missing_email: boolean;
  is_invalid_email: boolean;
  is_missing_first_name: boolean;
  is_missing_last_name: boolean;
  is_missing_billing_address: boolean;
  is_missing_shipping_address: boolean;
  is_email_used_as_name: boolean;
  is_suspicious_name: boolean;
  is_suspicious_email: boolean;
  is_flagged: boolean;
};

export type RegisteredAccountList = {
  page: number;
  page_size: number;
  quality: "all" | "flagged";
  total_count: number;
  accounts: RegisteredAccount[];
};

export const registeredAccountFlagLabels: Array<[keyof RegisteredAccount, string]> = [
  ["is_missing_email", "Missing email"],
  ["is_invalid_email", "Invalid email"],
  ["is_missing_first_name", "Missing first name"],
  ["is_missing_last_name", "Missing last name"],
  ["is_missing_billing_address", "Missing billing address"],
  ["is_missing_shipping_address", "Missing shipping address"],
  ["is_email_used_as_name", "Name is the email"],
  ["is_suspicious_name", "Suspicious name"],
  ["is_suspicious_email", "Suspicious email"],
];

export const registeredAccountsApi = {
  async list(params: { page: number; pageSize: number; q: string; quality: "all" | "flagged" }): Promise<RegisteredAccountList> {
    const search = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
      quality: params.quality,
    });
    const query = params.q.trim();
    if (query) {
      search.set("q", query);
    }
    return fetchJson<RegisteredAccountList>(`/api/v1/security/registered-accounts?${search.toString()}`);
  },
};
