import { describe, expect, it } from "vitest";
import { groupPackingOrdersByUser } from "./packing";

describe("groupPackingOrdersByUser", () => {
  it("groups active orders by packer and pins the current user first", () => {
    const groups = groupPackingOrdersByUser(
      [
        { order_id: 1, packed_by: "Alex Smith" },
        { order_id: 2, packed_by: "Jeremy Trevatt" },
        { order_id: 3, packed_by: "Alex Smith" },
      ],
      "Jeremy Trevatt",
    );

    expect(groups.map(group => group.username)).toEqual([
      "Jeremy Trevatt",
      "Alex Smith",
    ]);
    expect(groups[0].isCurrentUser).toBe(true);
    expect(groups[1].orders.map(order => order.order_id)).toEqual([1, 3]);
  });

  it("uses a visible label when a tracking row has no username", () => {
    const groups = groupPackingOrdersByUser([{ order_id: 1 }], "Jeremy Trevatt");
    expect(groups[0].username).toBe("Unknown packer");
  });
});
