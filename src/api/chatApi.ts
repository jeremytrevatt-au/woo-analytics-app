import { fetchJson, requireApiBaseUrl } from "./httpClient";
import {
  ChatConversation,
  ChatConversationStatus,
  ChatInboxResponse,
  ChatMessage,
  ChatMessagesResponse,
  ChatAttachment,
  ChatUnreadSummary,
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
  attachmentIds: string[] = [],
  clientMessageId = crypto.randomUUID(),
): Promise<ChatMessage> {
  return fetchJson<ChatMessage>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        client_message_id: clientMessageId,
        body,
        attachment_ids: attachmentIds,
      }),
    },
  );
}

export function getChatUnreadSummary(): Promise<ChatUnreadSummary> {
  return fetchJson<ChatUnreadSummary>("/api/v1/chat/unread-summary");
}

export function markChatConversationRead(conversationId: string): Promise<void> {
  return fetchJson<void>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/read`,
    { method: "POST" },
  );
}

export function uploadChatAttachment(
  conversationId: string,
  file: File,
): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("upload", file);
  return fetchJson<ChatAttachment>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/attachments`,
    { method: "POST", body: form },
  );
}

export function chatMessageEventsUrl(conversationId: string): string {
  return `${requireApiBaseUrl()}/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/events`;
}

export function chatAttachmentUrl(
  conversationId: string,
  attachmentId: string,
): string {
  return `${requireApiBaseUrl()}/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}`;
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
