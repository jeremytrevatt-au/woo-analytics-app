import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listCrmCustomerEmailHistory } from "../api/crmApi";
import CustomerEmailHistorySection from "./CustomerEmailHistorySection";

vi.mock("../api/crmApi", () => ({
  listCrmCustomerEmailHistory: vi.fn(),
}));

describe("CustomerEmailHistorySection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows synchronized Gmail history with an original-message search link", async () => {
    vi.mocked(listCrmCustomerEmailHistory).mockResolvedValue({
      sync_state: "ok",
      last_synced_at: "2026-09-20T22:00:00+00:00",
      watch_expiration_ms: 1790000000000,
      messages: [
        {
          message_id: "message-1",
          thread_id: "thread-1",
          subject: "Order question",
          snippet: "Can you confirm the delivery date?",
          sent_at: "2026-09-20T21:00:00+00:00",
          direction: "inbound",
          from_name: "Customer",
          from_address: "customer@example.com",
          to_addresses: ["shop-staging@naturalyield.com.au"],
          gmail_url: "https://mail.google.com/mail/u/?authuser=shop-staging%40naturalyield.com.au#search/message",
        },
      ],
    });

    const view = render(
      <CustomerEmailHistorySection customerEmail="customer@example.com" />,
    );

    await waitFor(() => expect(listCrmCustomerEmailHistory).toHaveBeenCalledWith(
      "customer@example.com",
    ));
    expect(await view.findByText("Order question")).toBeInTheDocument();
    expect(view.getByText("Inbound")).toBeInTheDocument();
    expect(view.getByRole("link", { name: "Open in Gmail" })).toHaveAttribute(
      "href",
      expect.stringContaining("mail.google.com"),
    );
  });

  it("reports that the connector is not configured without inventing history", async () => {
    vi.mocked(listCrmCustomerEmailHistory).mockResolvedValue({
      sync_state: "not_configured",
      last_synced_at: null,
      watch_expiration_ms: null,
      messages: [],
    });

    const view = render(
      <CustomerEmailHistorySection customerEmail="customer@example.com" />,
    );

    expect(
      await view.findByText("The Gmail connector is not configured for this environment."),
    ).toBeInTheDocument();
    expect(view.queryByText("Open in Gmail")).not.toBeInTheDocument();
  });
});
