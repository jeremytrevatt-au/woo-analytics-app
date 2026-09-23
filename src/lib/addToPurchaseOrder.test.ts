import { describe, expect, it } from "vitest";
import { mergePurchaseOrderLines, purchaseOrderLineKey, stockSelectionToPurchaseOrderLine } from "./addToPurchaseOrder";

describe("addToPurchaseOrder", () => {
  it("preserves existing PO line IDs while adding a selected variation", () => {
    const result = mergePurchaseOrderLines(
      [{ id: 41, product_id: 100, sku: "EXISTING", product_name: "Existing", qty: 2 }],
      [{ product_id: 201, product_type: "variation", sku: "VAR-BLUE", product_name: "Blue variation" }],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 41, qty: 2 });
    expect(result[1]).toMatchObject({ product_id: 201, sku: "VAR-BLUE", qty: 1 });
  });

  it("merges matching stock targets without mutating the existing line", () => {
    const existing = { id: 42, product_id: 100, sku: "SAME-SKU", product_name: "Existing", qty: 2 };
    const result = mergePurchaseOrderLines(
      [existing],
      [{ product_id: 100, sku: "same-sku", product_name: "Existing", qty: 3 }],
    );

    expect(result).toEqual([{ ...existing, qty: 5 }]);
    expect(existing.qty).toBe(2);
  });

  it("uses WSVI group identity ahead of parent product identity", () => {
    expect(purchaseOrderLineKey({ product_id: 10, sku: "PACK", wsvi_group_id: "group-a" })).toBe("wsvi:group-a");
    expect(stockSelectionToPurchaseOrderLine({
      product_id: "10",
      product_type: "wsvi_group",
      wsvi_group_id: "group-a",
      sku: "PACK",
      product_name: "Pack",
    })).toMatchObject({ product_id: 10, wsvi_group_id: "group-a", qty: 1 });
  });
});
