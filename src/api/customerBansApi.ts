import { fetchJson } from "./httpClient";

export type CustomerBan = {
  id: number;
  is_active: boolean;
  name_pattern: string;
  email_pattern: string;
  phone_pattern: string;
  address_pattern: string;
  match_mode: string;
  notes: string;
  linked_customer_ids: number[];
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  last_match_at: string | null;
  last_suspend_at: string | null;
};

export type CustomerBanMatch = {
  user_id: number;
  match_fields: string[];
  email: string;
  display_name: string;
};

export type CustomerBanList = {
  page: number;
  page_size: number;
  active: "all" | "yes" | "no";
  total_count: number;
  bans: CustomerBan[];
};

export type CustomerBanPatterns = {
  name_pattern?: string;
  email_pattern?: string;
  phone_pattern?: string;
  address_pattern?: string;
  notes?: string;
  is_active?: boolean;
};

export type CustomerBanSuspendResult = {
  suspended_ids: number[];
  already_suspended_ids: number[];
  failed_ids: number[];
};

export type CustomerBanWriteResult = {
  ban: CustomerBan;
  suspend_result: CustomerBanSuspendResult;
};

export type CustomerBanMatchPreview = {
  patterns: CustomerBanPatterns;
  match_count: number;
  is_guest_only_rule: boolean;
  matches: CustomerBanMatch[];
};

export const customerBansApi = {
  async list(params: { page: number; pageSize: number; active: "all" | "yes" | "no" }): Promise<CustomerBanList> {
    const search = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
      active: params.active,
    });
    return fetchJson<CustomerBanList>(`/api/v1/customer-bans?${search.toString()}`);
  },

  async matchPreview(patterns: CustomerBanPatterns): Promise<CustomerBanMatchPreview> {
    return fetchJson<CustomerBanMatchPreview>("/api/v1/customer-bans/match-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patterns),
    });
  },

  async create(patterns: CustomerBanPatterns): Promise<CustomerBanWriteResult> {
    return fetchJson<CustomerBanWriteResult>("/api/v1/customer-bans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patterns),
    });
  },

  async update(banId: number, patch: CustomerBanPatterns): Promise<CustomerBanWriteResult> {
    return fetchJson<CustomerBanWriteResult>(`/api/v1/customer-bans/${banId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },
};
