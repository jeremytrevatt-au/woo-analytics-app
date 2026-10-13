import { describe, expect, it } from "vitest";
import { getCustomerMatchKey, groupPackingOrdersByUser } from "./packing";

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

describe("getCustomerMatchKey", () => {
  it("treats the server key as authoritative so a guest groups with the registered customer", () => {
    const guest = {
      order_id: 9701,
      customer_id: 0,
      customer_match_key: "customer:1987",
      billing_phone: "(04) 0000-1987",
      billing_email: "shared@example.test",
    };
    const registered = {
      order_id: 9702,
      customer_id: 1987,
      customer_match_key: "customer:1987",
      billing_phone: "0400001987",
      billing_email: "shared@example.test",
    };

    expect(getCustomerMatchKey(guest)).toBe("customer:1987");
    expect(getCustomerMatchKey(registered)).toBe(getCustomerMatchKey(guest));
  });

  it("keeps a server order key instead of recomputing a phone key", () => {
    expect(getCustomerMatchKey({
      customer_match_key: "order:9701",
      customer_id: 0,
      billing_phone: "0400001987",
      billing_email: "shared@example.test",
    })).toBe("order:9701");
  });

  it("uses the customer id, phone, or email on this order when the API omits the key", () => {
    expect(getCustomerMatchKey({
      customer_id: 1987,
      billing_phone: "0400001987",
    })).toBe("customer:1987");
    expect(getCustomerMatchKey({
      customer_id: 0,
      billing_phone: "(04) 0000-1987",
      billing_email: "shared@example.test",
    })).toBe("phone:0400001987");
    expect(getCustomerMatchKey({
      customer_id: 0,
      billing_email: " Shared@Example.TEST ",
    })).toBe("email:shared@example.test");
    expect(getCustomerMatchKey({ customer_id: 0 })).toBe("");
  });
});
