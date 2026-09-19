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
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "operator";
  sender_id: string;
  body: string;
  created_at: string;
};

export type ChatInboxResponse = {
  conversations: ChatConversation[];
};

export type ChatMessagesResponse = {
  messages: ChatMessage[];
};
