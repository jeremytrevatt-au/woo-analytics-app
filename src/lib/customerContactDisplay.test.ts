import { describe, expect, it } from "vitest";
import {
  billingAddressFromProfile,
  customerAddressHasContent,
  customerContactLines,
  formatCustomerAddressLines,
  shippingAddressFromProfile,
} from "./customerContactDisplay";

describe("customerContactDisplay", () => {
  it("shows both emails when both are set", () => {
    expect(
      customerContactLines({
        user_email: "user@example.test",
        billing_email: "billing@example.test",
      }),
    ).toEqual([
      { label: "User email", value: "user@example.test" },
      { label: "Billing email", value: "billing@example.test" },
    ]);
  });

  it("shows both phones when they differ", () => {
    expect(
      customerContactLines({
        billing_phone: "0400000001",
        shipping_phone: "0400000002",
      }),
    ).toEqual([
      { label: "Billing phone", value: "0400000001" },
      { label: "Shipping phone", value: "0400000002" },
    ]);
  });

  it("hides duplicate shipping phone", () => {
    expect(
      customerContactLines({
        billing_phone: "0400000001",
        shipping_phone: "0400000001",
      }),
    ).toEqual([{ label: "Billing phone", value: "0400000001" }]);
  });

  it("formats address lines and detects content", () => {
    const billing = billingAddressFromProfile({
      billing_first_name: "Ada",
      billing_last_name: "Lovelace",
      billing_address_1: "10 Example St",
      billing_city: "Melbourne",
      billing_state: "VIC",
      billing_postcode: "3000",
      billing_country: "AU",
    });
    expect(customerAddressHasContent(billing)).toBe(true);
    expect(formatCustomerAddressLines(billing)).toEqual([
      "Ada Lovelace",
      "10 Example St",
      "Melbourne VIC 3000",
      "AU",
    ]);
    expect(customerAddressHasContent(shippingAddressFromProfile({}))).toBe(false);
  });
});
