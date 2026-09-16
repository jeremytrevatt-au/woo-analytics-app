import type { ProductSearchResult } from "../api/productsApi";
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";

export type IndexedPurchaseOrderLine = {
  line: PurchaseOrderLine;
  originalIndex: number;
};

function normalise(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function productRank(product: ProductSearchResult, query: string): number | null {
  const sku = normalise(product.sku);
  const name = normalise(product.name);

  if (sku === query) return 0;
  if (sku.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (sku.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return null;
}

export function searchProductIndex(
  products: readonly ProductSearchResult[],
  queryValue: string,
  limit = 20,
): ProductSearchResult[] {
  const query = normalise(queryValue);
  if (query.length < 2) return [];

  return products
    .map((product) => ({ product, rank: productRank(product, query) }))
    .filter((entry): entry is { product: ProductSearchResult; rank: number } => entry.rank !== null)
    .sort((left, right) => (
      left.rank - right.rank
      || normalise(left.product.sku).localeCompare(normalise(right.product.sku))
      || normalise(left.product.name).localeCompare(normalise(right.product.name))
    ))
    .slice(0, limit)
    .map((entry) => entry.product);
}

export function findExistingProductLine(
  lines: readonly PurchaseOrderLine[],
  product: ProductSearchResult,
): number | null {
  const productSku = normalise(product.sku);
  const index = lines.findIndex((line) => (
    Number(line.product_id) === Number(product.id)
    || (productSku !== "" && normalise(line.sku) === productSku)
  ));
  return index >= 0 ? index : null;
}

export function filterPurchaseOrderLines(
  lines: readonly PurchaseOrderLine[],
  queryValue: string,
): IndexedPurchaseOrderLine[] {
  const query = normalise(queryValue);
  return lines
    .map((line, originalIndex) => ({ line, originalIndex }))
    .filter(({ line }) => (
      query === ""
      || normalise(line.sku).includes(query)
      || normalise(line.product_name).includes(query)
      || normalise(line.supplier_sku).includes(query)
    ));
}

export function wooProductEditUrl(editProductId: unknown): string | null {
  const productId = Number(editProductId);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return `https://naturalyield.com.au/wp-admin/post.php?post=${productId}&action=edit`;
}
