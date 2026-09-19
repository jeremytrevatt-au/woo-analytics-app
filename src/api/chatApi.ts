import { fetchJson } from "./httpClient";
import {
  ChatConversation,
  ChatConversationStatus,
  ChatInboxResponse,
  ChatMessage,
  ChatMessagesResponse,
} from "../types/chat";

export function listChatConversations(
  status?: ChatConversationStatus,
): Promise<ChatInboxResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJson<ChatInboxResponse>(`/api/v1/chat/inbox${query}`);
}

export function listChatMessages(
  conversationId: string,
): Promise<ChatMessagesResponse> {
  return fetchJson<ChatMessagesResponse>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

export function sendChatReply(
  conversationId: string,
  body: string,
  clientMessageId = crypto.randomUUID(),
): Promise<ChatMessage> {
  return fetchJson<ChatMessage>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        client_message_id: clientMessageId,
        body,
      }),
    },
  );
}

export function updateChatConversation(
  conversationId: string,
  status: ChatConversationStatus,
  assignedOperatorEmail?: string | null,
): Promise<ChatConversation> {
  return fetchJson<ChatConversation>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        assigned_operator_email: assignedOperatorEmail ?? null,
      }),
    },
  );
}
