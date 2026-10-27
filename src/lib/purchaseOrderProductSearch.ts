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

export type PurchaseOrderQtyFilter =
  | "all"
  | "zero"
  | "positive"
  | "preordered_positive"
  | "backordered_positive";

export function purchaseOrderLineQtyValue(qty: unknown): number | null {
  if (qty === "" || qty === null || qty === undefined) return 0;
  const parsed = Number(qty);
  return Number.isFinite(parsed) ? parsed : null;
}

function purchaseOrderDemandQtyValue(qty: unknown): number {
  if (qty === "—" || qty === "–") return 0;
  const value = purchaseOrderLineQtyValue(qty);
  return value === null ? 0 : value;
}

export function matchesPurchaseOrderQtyFilter(
  line: Pick<PurchaseOrderLine, "qty" | "preordered_qty" | "backordered_qty"> | unknown,
  qtyFilter: PurchaseOrderQtyFilter,
): boolean {
  if (qtyFilter === "all") return true;
  const record = line && typeof line === "object"
    ? line as Pick<PurchaseOrderLine, "qty" | "preordered_qty" | "backordered_qty">
    : { qty: line };
  if (qtyFilter === "preordered_positive") {
    return purchaseOrderDemandQtyValue(record.preordered_qty) > 0;
  }
  if (qtyFilter === "backordered_positive") {
    return purchaseOrderDemandQtyValue(record.backordered_qty) > 0;
  }
  const value = purchaseOrderLineQtyValue(record.qty);
  if (value === null) return false;
  if (qtyFilter === "zero") return value === 0;
  return value > 0;
}

export function filterPurchaseOrderLines(
  lines: readonly PurchaseOrderLine[],
  queryValue: string,
  qtyFilter: PurchaseOrderQtyFilter = "all",
): IndexedPurchaseOrderLine[] {
  const query = normalise(queryValue);
  return lines
    .map((line, originalIndex) => ({ line, originalIndex }))
    .filter(({ line }) => (
      (
        query === ""
        || normalise(line.sku).includes(query)
        || normalise(line.product_name).includes(query)
        || normalise(line.supplier_sku).includes(query)
      )
      && matchesPurchaseOrderQtyFilter(line, qtyFilter)
    ));
}

export function wooProductEditUrl(editProductId: unknown): string | null {
  const productId = Number(editProductId);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return `https://naturalyield.com.au/wp-admin/post.php?post=${productId}&action=edit`;
}
