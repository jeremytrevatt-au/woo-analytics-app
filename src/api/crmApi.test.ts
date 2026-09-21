import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCrmCustomerEmailHistory } from "./crmApi";
import { fetchJson } from "./httpClient";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

describe("listCrmCustomerEmailHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the customer email out of the request URL", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      messages: [],
      sync_state: "ok",
      last_synced_at: null,
      watch_expiration_ms: null,
    });

    await listCrmCustomerEmailHistory("customer@example.com", 10);

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/crm/customer-email-history",
      {
        method: "POST",
        body: JSON.stringify({
          customer_email: "customer@example.com",
          limit: 10,
        }),
      },
    );
    expect(vi.mocked(fetchJson).mock.calls[0][0]).not.toContain(
      "customer@example.com",
    );
  });
});
