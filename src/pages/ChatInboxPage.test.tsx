import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import {
  listChatConversations,
  listChatMessages,
  sendChatReply,
  markChatConversationRead,
  uploadChatAttachment,
  updateChatConversation,
} from "../api/chatApi";
import ChatInboxPage from "./ChatInboxPage";

vi.mock("../api/chatApi", () => ({
  listChatConversations: vi.fn(),
  listChatMessages: vi.fn(),
  sendChatReply: vi.fn(),
  markChatConversationRead: vi.fn(),
  uploadChatAttachment: vi.fn(),
  chatMessageEventsUrl: vi.fn(() => "https://example.test/events"),
  chatAttachmentUrl: vi.fn(() => "https://example.test/attachment"),
  updateChatConversation: vi.fn(),
}));

vi.mock("../config/wordpress", () => ({
  wordpressStorefrontUrl: vi.fn(
    (path: string) => `https://staging.naturalyield.com.au${path}`,
  ),
}));

const conversation = {
  id: "conversation-1",
  channel: "website_chat",
  status: "open" as const,
  created_at: "2026-09-19T07:00:00Z",
  updated_at: "2026-09-19T07:01:00Z",
  woo_customer_id: null,
  customer_display_name: "NYA-Staging-Admin",
  customer_page_path: "/shop/sample-product",
  customer_page_title: "Sample product",
};

describe("ChatInboxPage", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", class {
      addEventListener() {}
      close() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
        {
          id: "message-2",
          conversation_id: conversation.id,
          sender_type: "operator",
          sender_id: "operator:operator@naturalyield.com.au",
          body: "We are looking into it.",
          created_at: "2026-09-19T07:01:30Z",
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
    vi.mocked(markChatConversationRead).mockResolvedValue(undefined);

    const view = render(<MemoryRouter><ChatInboxPage /></MemoryRouter>);

    expect((await view.findAllByText("NYA-Staging-Admin")).length).toBeGreaterThan(0);
    expect(await view.findByText("Can you help with my order?")).toBeInTheDocument();
    expect(view.getByLabelText("operator message")).toHaveTextContent(
      "We are looking into it.",
    );
    expect(view.getByRole("link", { name: "Sample product" })).toHaveAttribute(
      "href",
      "https://staging.naturalyield.com.au/shop/sample-product",
    );

    fireEvent.change(view.getByLabelText("Reply"), {
      target: { value: "Yes, we can help." },
    });
    fireEvent.click(view.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sendChatReply).toHaveBeenCalledWith(
      conversation.id,
      "Yes, we can help.",
      [],
    ));
  });
});
