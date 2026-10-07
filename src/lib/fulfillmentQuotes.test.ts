import { describe, expect, it } from "vitest";
import type { PackingQuoteResponse } from "../api/shippitPackingApi";
import { fulfillmentQuoteOptions } from "./fulfillmentQuotes";

const mixedQuote: PackingQuoteResponse = {
  name: "fulfillment_quote",
  method: "POST",
  url: "https://app.staging.shippit.com/api/3/quotes",
  status_code: 200,
  duration_ms: 20,
  body: {
    response: [
      {
        carrier_id: "shippit",
        courier_type: "CouriersPlease",
        service_level: "standard",
        courier_name: "Couriers Please",
        quotes: [{ price: 11.5, carrier_id: "shippit" }],
      },
      {
        carrier_id: "australia_post",
        courier_type: "australia_post",
        service_level: "B30",
        product_id: "B30",
        courier_name: "Australia Post Parcel Post (B30)",
        quotes: [{ price: 8.95, carrier_id: "australia_post", product_id: "B30" }],
      },
    ],
  },
};

describe("fulfillmentQuoteOptions", () => {
  it("lists Shippit couriers and Australia Post postage products in one quote list", () => {
    const options = fulfillmentQuoteOptions(mixedQuote);

    expect(options.map(option => option.carrier_id)).toEqual(["australia_post", "shippit"]);
    expect(options[0]).toEqual(expect.objectContaining({
      label: "Australia Post Parcel Post (B30)",
      carrier_id: "australia_post",
      product_id: "B30",
      price: 8.95,
    }));
    expect(options[1]).toEqual(expect.objectContaining({
      label: "Couriers Please",
      carrier_id: "shippit",
      product_id: null,
      courier_type: "CouriersPlease",
      service_level: "standard",
      price: 11.5,
    }));
  });
});
