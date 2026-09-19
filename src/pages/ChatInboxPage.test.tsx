import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listChatConversations,
  listChatMessages,
  sendChatReply,
  updateChatConversation,
} from "../api/chatApi";
import ChatInboxPage from "./ChatInboxPage";

vi.mock("../api/chatApi", () => ({
  listChatConversations: vi.fn(),
  listChatMessages: vi.fn(),
  sendChatReply: vi.fn(),
  updateChatConversation: vi.fn(),
}));

const conversation = {
  id: "conversation-1",
  channel: "website_chat",
  status: "open" as const,
  created_at: "2026-09-19T07:00:00Z",
  updated_at: "2026-09-19T07:01:00Z",
  woo_customer_id: null,
};

describe("ChatInboxPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads an Inbox conversation and sends an operator reply", async () => {
    vi.mocked(listChatConversations).mockResolvedValue({
      conversations: [conversation],
    });
    vi.mocked(listChatMessages).mockResolvedValue({
      messages: [
        {
          id: "message-1",
          conversation_id: conversation.id,
          sender_type: "customer",
          sender_id: "wordpress:1978",
          body: "Can you help with my order?",
          created_at: "2026-09-19T07:01:00Z",
        },
      ],
    });
    vi.mocked(sendChatReply).mockResolvedValue({
      id: "message-2",
      conversation_id: conversation.id,
      sender_type: "operator",
      sender_id: "operator:operator@naturalyield.com.au",
      body: "Yes, we can help.",
      created_at: "2026-09-19T07:02:00Z",
    });
    vi.mocked(updateChatConversation).mockResolvedValue(conversation);

    const view = render(<ChatInboxPage />);

    expect(await view.findByText("Customer unlinked")).toBeInTheDocument();
    expect(await view.findByText("Can you help with my order?")).toBeInTheDocument();

    fireEvent.change(view.getByLabelText("Reply"), {
      target: { value: "Yes, we can help." },
    });
    fireEvent.click(view.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendChatReply).toHaveBeenCalledWith(
      conversation.id,
      "Yes, we can help.",
    ));
  });
});
