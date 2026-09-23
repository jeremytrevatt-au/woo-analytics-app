import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";

export type StockPurchaseOrderSelection = {
  product_id: number | string;
  product_type?: string;
  type?: string;
  wsvi_group_id?: string | null;
  sku?: string;
  product_name?: string;
  name?: string;
  qty?: number | string;
};

export function purchaseOrderLineKey(line: Pick<PurchaseOrderLine, "product_id" | "sku" | "wsvi_group_id">): string {
  const wsviGroupId = String(line.wsvi_group_id || "").trim();
  if (wsviGroupId) return `wsvi:${wsviGroupId}`;
  const sku = String(line.sku || "").trim().toLowerCase();
  if (sku) return `sku:${sku}`;
  return `product:${Number(line.product_id)}`;
}

export function stockSelectionToPurchaseOrderLine(item: StockPurchaseOrderSelection): PurchaseOrderLine {
  const qty = Number(item.qty ?? 1);
  return {
    product_id: Number(item.product_id),
    wsvi_group_id: item.wsvi_group_id || undefined,
    sku: item.sku || "",
    product_name: item.product_name || item.name || "",
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    supplier_sku: "",
    supplier_unit_price: 0,
    unit_price_aud: 0,
    supplier_total: 0,
    total_aud: 0,
  };
}

export function mergePurchaseOrderLines(
  currentLines: PurchaseOrderLine[],
  selectedItems: StockPurchaseOrderSelection[],
): PurchaseOrderLine[] {
  const merged = currentLines.map((line) => ({ ...line }));
  const indexByKey = new Map(merged.map((line, index) => [purchaseOrderLineKey(line), index]));

  for (const selectedItem of selectedItems) {
    const newLine = stockSelectionToPurchaseOrderLine(selectedItem);
    const key = purchaseOrderLineKey(newLine);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(newLine);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      qty: Number(existing.qty || 0) + Number(newLine.qty || 0),
    };
  }

  return merged;
}
