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

/**
 * An unpacked line is awaiting stock only when remaining qty exceeds the qty
 * already reduced on that line (`_reduced_stock`). Prefer live line fields from
 * fulfillment merge; fall back to the server `has_backorders` flag.
 */
export function orderHasAwaitingStock(order: {
  has_backorders?: boolean | null;
  lines?: Array<{
    is_bundle_parent?: boolean | null;
    remaining_quantity?: number | string | null;
    reduced_stock?: number | string | null;
    stock_status?: string | null;
  }> | null;
}): boolean {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const hasReducedMeta = lines.some(line => line?.reduced_stock != null);
  if (hasReducedMeta) {
    return lines.some(line => {
      if (line?.is_bundle_parent) {
        return false;
      }
      const remaining = Math.max(0, Number(line?.remaining_quantity ?? 0));
      const reduced = Math.max(0, Number(line?.reduced_stock ?? 0));
      const stockStatus = String(line?.stock_status || "").toLowerCase();
      return (
        remaining > reduced
        && (stockStatus === "outofstock" || stockStatus === "onbackorder")
      );
    });
  }
  return !!order?.has_backorders;
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
