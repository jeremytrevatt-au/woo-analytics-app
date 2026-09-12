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
