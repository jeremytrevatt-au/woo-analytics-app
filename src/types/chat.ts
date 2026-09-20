export type ChatConversationStatus = "open" | "assigned" | "waiting" | "closed";

export type ChatConversation = {
  id: string;
  channel: string;
  status: ChatConversationStatus;
  created_at: string;
  updated_at?: string | null;
  wordpress_user_id?: number | null;
  woo_customer_id?: number | null;
  assigned_operator_email?: string | null;
  unread_count?: number;
  customer_page_path?: string | null;
  customer_page_title?: string | null;
  customer_last_seen_at?: string | null;
  last_customer_message_at?: string | null;
  customer_display_name?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_identity_type?: "logged_in" | "guest";
  guest_email?: string | null;
  guest_order_number?: string | null;
  guest_identity_status?: "not_provided" | "provided_unverified" | "new_sales" | null;
};

export type ChatAttachment = {
  id: string;
  conversation_id: string;
  content_type: string;
  width: number;
  height: number;
  size_bytes: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "operator";
  sender_id: string;
  body: string;
  created_at: string;
  attachments?: ChatAttachment[];
};

export type ChatInboxResponse = {
  conversations: ChatConversation[];
};

export type ChatMessagesResponse = {
  messages: ChatMessage[];
};

export type ChatUnreadSummary = {
  unread_conversation_count: number;
  conversations: ChatConversation[];
};
