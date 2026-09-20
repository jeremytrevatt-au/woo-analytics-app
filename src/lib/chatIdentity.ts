import { ChatConversation } from "../types/chat";

export function chatCustomerLabel(conversation: ChatConversation): string {
  if (conversation.customer_identity_type === "guest") {
    if (conversation.guest_email) return `Guest — ${conversation.guest_email}`;
    if (conversation.guest_order_number) {
      return `Guest — order ${conversation.guest_order_number}`;
    }
    if (conversation.guest_identity_status === "new_sales") {
      return "Guest — New sales";
    }
    return conversation.customer_display_name || "Guest";
  }
  const fullName = [
    conversation.customer_first_name,
    conversation.customer_last_name,
  ].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (conversation.customer_display_name) return conversation.customer_display_name;
  return `Customer ${conversation.woo_customer_id ?? "unlinked"}`;
}
