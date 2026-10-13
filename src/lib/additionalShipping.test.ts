import { describe, expect, it } from "vitest";
import { additionalShippingBlocksBooking, inclusiveQuotePrice } from "./additionalShipping";

describe("inclusiveQuotePrice", () => {
  it("uses the Australia Post GST-inclusive total and the Shippit price", () => {
    expect(inclusiveQuotePrice({ carrier_id: "australia_post", price: 1, total_cost: 8.95 })).toBe(8.95);
    expect(inclusiveQuotePrice({ price: 12.34 }, "shippit")).toBe(12.34);
  });
});

describe("additionalShippingBlocksBooking", () => {
  it("blocks booking only while the linked order needs payment", () => {
    expect(additionalShippingBlocksBooking("unpaid")).toBe(true);
    expect(additionalShippingBlocksBooking("paid")).toBe(false);
    expect(additionalShippingBlocksBooking("none")).toBe(false);
  });
});
