/**
 * Group key for packing orders.
 *
 * `customer_match_key` from the packing API is authoritative. The service
 * remaps a guest order to `customer:{id}` when its billing phone, or otherwise
 * its billing email, matches exactly one registered customer. This fallback
 * has no registered-customer directory. When the API omits the key it can only
 * use the customer id, phone, or email already on this order, so a guest stays
 * on `phone:` or `email:` until the server key is present.
 */
export function getCustomerMatchKey(order: {
  customer_match_key?: string | null;
  customer_id?: number | string | null;
  billing_phone?: string | null;
  billing_email?: string | null;
}): string {
  const apiKey = String(order.customer_match_key || "").trim();
  if (apiKey) return apiKey;

  const customerId = Number(order.customer_id || 0);
  if (customerId > 0) return `customer:${customerId}`;

  const phone = String(order.billing_phone || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  const email = String(order.billing_email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  return "";
}

export type PackingUserGroup = {
  username: string;
  isCurrentUser: boolean;
  orders: any[];
};

export function groupPackingOrdersByUser(
  orders: any[],
  currentUser: string,
): PackingUserGroup[] {
  const groups = new Map<string, any[]>();

  orders.forEach(order => {
    const username = String(order.packed_by || "Unknown packer").trim() || "Unknown packer";
    groups.set(username, [...(groups.get(username) || []), order]);
  });

  return Array.from(groups.entries())
    .map(([username, groupedOrders]) => ({
      username,
      isCurrentUser: username.toLowerCase() === currentUser.trim().toLowerCase(),
      orders: groupedOrders,
    }))
    .sort((left, right) => {
      if (left.isCurrentUser !== right.isCurrentUser) {
        return left.isCurrentUser ? -1 : 1;
      }
      return left.username.localeCompare(right.username);
    });
}
