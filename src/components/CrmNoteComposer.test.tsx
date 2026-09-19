import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCrmNote } from "../api/crmApi";
import CrmNoteComposer from "./CrmNoteComposer";

vi.mock("../api/crmApi", () => ({
  createCrmNote: vi.fn(),
}));

describe("CrmNoteComposer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("adds an order-linked workflow CRM Note", async () => {
    vi.mocked(createCrmNote).mockResolvedValue({
      id: 1,
      customer_id: 0,
      customer_key: "",
      customer_email: "customer@example.com",
      customer_phone: "0491570006",
      order_id: 134254,
      trigger_event: "reshipment",
      status: "open",
      reminder_date: null,
      note_content: "Replacement requested by support.",
      created_by: 1,
      created_by_name: "Tester",
      created_at: "2026-09-19",
      updated_at: "2026-09-19",
    });

    const view = render(
      <CrmNoteComposer
        orderId={134254}
        customerEmail="customer@example.com"
        customerPhone="0491570006"
        triggerEvent="reshipment"
      />,
    );
    fireEvent.change(view.getByLabelText("CRM Note"), {
      target: { value: "Replacement requested by support." },
    });
    fireEvent.click(view.getByRole("button", { name: "Add CRM Note" }));

    await waitFor(() => expect(createCrmNote).toHaveBeenCalledWith({
      customer_email: "customer@example.com",
      customer_phone: "0491570006",
      order_id: 134254,
      trigger_event: "reshipment",
      reminder_date: undefined,
      note_content: "Replacement requested by support.",
    }));
    expect(view.getByText("CRM Note added.")).toBeInTheDocument();
  });
});
