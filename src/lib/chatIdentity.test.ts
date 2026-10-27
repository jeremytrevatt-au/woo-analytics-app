import { describe, expect, it } from "vitest";
import { conversationCouponEmail } from "./chatIdentity";

describe("conversationCouponEmail", () => {
  it("prefills from the conversation guest email", () => {
    expect(conversationCouponEmail({ guest_email: "  guest@example.test " }))
      .toBe("guest@example.test");
    expect(conversationCouponEmail({ guest_email: null })).toBe("");
  });

  it("prefills a new Woo customer from user email before guest email", () => {
    expect(conversationCouponEmail({
      user_email: "ms.j.graybill@gmail.com",
      billing_email: "",
      guest_email: null,
    })).toBe("ms.j.graybill@gmail.com");
  });
});
