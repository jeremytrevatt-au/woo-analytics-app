import { describe, expect, it } from "vitest";
import { conversationCouponEmail } from "./chatIdentity";

describe("conversationCouponEmail", () => {
  it("prefills from the conversation guest email", () => {
    expect(conversationCouponEmail({ guest_email: "  guest@example.test " }))
      .toBe("guest@example.test");
    expect(conversationCouponEmail({ guest_email: null })).toBe("");
  });
});
