import type {
  PackingQuoteResponse,
  PackingQuoteSelection,
} from "../api/shippitPackingApi";

export type FulfillmentQuoteOption = PackingQuoteSelection & {
  id: string;
  label: string;
};

export function fulfillmentQuoteOptions(
  response: PackingQuoteResponse | null,
): FulfillmentQuoteOption[] {
  const body = response?.body as {
    response?: unknown;
    quotes?: unknown;
  } | unknown[] | undefined;
  const carriers = Array.isArray(body)
    ? body
    : body && Array.isArray((body as { response?: unknown }).response)
      ? (body as { response: unknown[] }).response
      : body && Array.isArray((body as { quotes?: unknown }).quotes)
        ? (body as { quotes: unknown[] }).quotes
        : [];
  const options: FulfillmentQuoteOption[] = [];

  carriers.forEach((carrier, carrierIndex) => {
    if (!carrier || typeof carrier !== "object") return;
    const carrierData = carrier as Record<string, unknown>;
    const rows = Array.isArray(carrierData.quotes)
      ? carrierData.quotes
      : [carrierData];
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== "object") return;
      const quote = row as Record<string, unknown>;
      const courierType = String(
        carrierData.courier_type || quote.courier_type || "",
      );
      const serviceLevel = String(
        carrierData.service_level || quote.service_level || "",
      );
      const carrierId = String(
        quote.carrier_id || carrierData.carrier_id || "shippit",
      );
      const productId = String(
        quote.product_id || carrierData.product_id || "",
      );
      const price = Number(quote.price);
      if (
        (!courierType && !serviceLevel)
        || !Number.isFinite(price)
        || price <= 0
      ) {
        return;
      }
      options.push({
        id: `${carrierIndex}-${rowIndex}-${carrierId}-${courierType}-${serviceLevel}`,
        label: String(
          carrierData.courier_name
          || quote.courier_name
          || courierType
          || serviceLevel,
        ),
        carrier_id: carrierId,
        product_id: carrierId === "australia_post" ? productId || serviceLevel || null : null,
        courier_type: courierType || null,
        service_level: serviceLevel || null,
        price,
        estimated_transit_time:
          typeof quote.estimated_transit_time === "string"
            ? quote.estimated_transit_time
            : null,
      });
    });
  });

  return options.sort((left, right) => Number(left.price) - Number(right.price));
}
