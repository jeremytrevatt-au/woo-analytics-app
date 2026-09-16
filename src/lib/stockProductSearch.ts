const stockSearchFields = [
  "sku",
  "product_name",
  "name",
  "child_skus",
  "parent_sku",
] as const;

function normalise(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim().toLocaleLowerCase()
    : "";
}

export function filterCurrentStockRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  queryValue: string,
): T[] {
  const query = normalise(queryValue);
  if (!query) return [...rows];

  return rows.filter((row) => stockSearchFields.some((field) => normalise(row[field]).includes(query)));
}
