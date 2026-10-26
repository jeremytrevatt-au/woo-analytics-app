export function outstandingDemandSortValue(
  value: number | null | undefined,
): number {
  return value === null || value === undefined
    ? Number.NEGATIVE_INFINITY
    : Number(value);
}

export function formatOutstandingDemandQty(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "—";
}
