export function inclusiveQuotePrice(quote: Record<string, unknown>, carrierHint = ""): number {
  const carrier = String(carrierHint || quote.carrier_id || quote.courier_type || "");
  if (carrier === "australia_post" && quote.total_cost != null && quote.total_cost !== "") {
    const totalCost = Number(quote.total_cost);
    if (Number.isFinite(totalCost)) return totalCost;
  }
  if (quote.price != null && quote.price !== "") {
    const price = Number(quote.price);
    if (Number.isFinite(price)) return price;
  }
  if (quote.total_cost != null && quote.total_cost !== "") {
    return Number(quote.total_cost);
  }
  return Number.NaN;
}

export function additionalShippingBlocksBooking(paymentState: string | null | undefined): boolean {
  return paymentState === "unpaid";
}
