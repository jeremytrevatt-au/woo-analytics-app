import { describe, expect, it } from "vitest";
import type { ProductSearchResult } from "../api/productsApi";
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";
import {
  filterPurchaseOrderLines,
  findExistingProductLine,
  matchesPurchaseOrderQtyFilter,
  searchProductIndex,
  wooProductEditUrl,
} from "./purchaseOrderProductSearch";

const products: ProductSearchResult[] = [
  { id: 1, name: "Blue Planter", sku: "PLAN-BLUE", type: "simple", edit_product_id: 1 },
  { id: 2, name: "Planter Stand", sku: "STAND-01", type: "simple", edit_product_id: 2 },
  { id: 3, name: "Planter Blue Large", sku: "PLAN-BLUE-L", type: "variation", parent_id: 10, edit_product_id: 10 },
];

const lines: PurchaseOrderLine[] = [
  { product_id: 3, sku: "PLAN-BLUE-L", product_name: "Planter Blue Large", supplier_sku: "SUP-L", qty: 1 },
  { product_id: 2, sku: "STAND-01", product_name: "Planter Stand", supplier_sku: "SUP-S", qty: 1 },
];

describe("purchase order product index", () => {
  it("ranks exact and prefix SKU matches before name matches", () => {
    expect(searchProductIndex(products, "PLAN-BLUE").map((product) => product.id)).toEqual([1, 3]);
  });

  it("finds an existing line by product identity or SKU", () => {
    expect(findExistingProductLine(lines, products[2])).toBe(0);
    expect(findExistingProductLine(lines, { ...products[2], id: 999 })).toBe(0);
  });

  it("filters PO lines without losing their original indices", () => {
    expect(filterPurchaseOrderLines(lines, "stand")).toEqual([{ line: lines[1], originalIndex: 1 }]);
    expect(filterPurchaseOrderLines(lines, "SUP-L")).toEqual([{ line: lines[0], originalIndex: 0 }]);
  });

  it("treats empty, 0, and 0.0 as zero qty and leaves all lines visible by default", () => {
    const mixed: PurchaseOrderLine[] = [
      { product_id: 1, sku: "ZERO", product_name: "Zero", qty: 0 },
      { product_id: 2, sku: "EMPTY", product_name: "Empty", qty: "" as unknown as number },
      { product_id: 3, sku: "FLOAT", product_name: "Float zero", qty: 0.0 },
      { product_id: 4, sku: "POS", product_name: "Positive", qty: 4 },
    ];
    expect(matchesPurchaseOrderQtyFilter({ qty: "" }, "zero")).toBe(true);
    expect(matchesPurchaseOrderQtyFilter({ qty: "0" }, "zero")).toBe(true);
    expect(matchesPurchaseOrderQtyFilter({ qty: 0.0 }, "zero")).toBe(true);
    expect(matchesPurchaseOrderQtyFilter({ qty: 4 }, "zero")).toBe(false);
    expect(filterPurchaseOrderLines(mixed, "", "all").map((entry) => entry.line.sku))
      .toEqual(["ZERO", "EMPTY", "FLOAT", "POS"]);
    expect(filterPurchaseOrderLines(mixed, "", "zero").map((entry) => entry.line.sku))
      .toEqual(["ZERO", "EMPTY", "FLOAT"]);
    expect(filterPurchaseOrderLines(mixed, "", "positive").map((entry) => entry.line.sku))
      .toEqual(["POS"]);
  });

  it("shows only lines with preordered_qty > 0, treating null, undefined, and dash as zero", () => {
    const mixed: PurchaseOrderLine[] = [
      { product_id: 1, sku: "PRE", product_name: "Pre", qty: 0, preordered_qty: 4, backordered_qty: 0 },
      { product_id: 2, sku: "BACK", product_name: "Back", qty: 9, preordered_qty: 0, backordered_qty: 7 },
      { product_id: 3, sku: "NULL-PRE", product_name: "Null pre", qty: 1, preordered_qty: null, backordered_qty: 2 },
      { product_id: 4, sku: "UNDEF-PRE", product_name: "Undef pre", qty: 1, backordered_qty: 1 },
      { product_id: 5, sku: "DASH-PRE", product_name: "Dash pre", qty: 1, preordered_qty: "—" as unknown as number },
    ];
    expect(matchesPurchaseOrderQtyFilter({ preordered_qty: 4 }, "preordered_positive")).toBe(true);
    expect(matchesPurchaseOrderQtyFilter({ preordered_qty: null }, "preordered_positive")).toBe(false);
    expect(matchesPurchaseOrderQtyFilter({ preordered_qty: undefined }, "preordered_positive")).toBe(false);
    expect(matchesPurchaseOrderQtyFilter({ preordered_qty: "—" }, "preordered_positive")).toBe(false);
    expect(filterPurchaseOrderLines(mixed, "", "preordered_positive").map((entry) => entry.line.sku))
      .toEqual(["PRE"]);
  });

  it("shows only lines with backordered_qty > 0, treating null, undefined, and dash as zero", () => {
    const mixed: PurchaseOrderLine[] = [
      { product_id: 1, sku: "PRE", product_name: "Pre", qty: 0, preordered_qty: 4, backordered_qty: 0 },
      { product_id: 2, sku: "BACK", product_name: "Back", qty: 9, preordered_qty: 0, backordered_qty: 7 },
      { product_id: 3, sku: "NULL-BACK", product_name: "Null back", qty: 1, preordered_qty: 2, backordered_qty: null },
      { product_id: 4, sku: "UNDEF-BACK", product_name: "Undef back", qty: 1, preordered_qty: 1 },
      { product_id: 5, sku: "DASH-BACK", product_name: "Dash back", qty: 1, backordered_qty: "—" as unknown as number },
    ];
    expect(matchesPurchaseOrderQtyFilter({ backordered_qty: 7 }, "backordered_positive")).toBe(true);
    expect(matchesPurchaseOrderQtyFilter({ backordered_qty: 0 }, "backordered_positive")).toBe(false);
    expect(matchesPurchaseOrderQtyFilter({ backordered_qty: null }, "backordered_positive")).toBe(false);
    expect(matchesPurchaseOrderQtyFilter({ backordered_qty: "—" }, "backordered_positive")).toBe(false);
    expect(filterPurchaseOrderLines(mixed, "", "backordered_positive").map((entry) => entry.line.sku))
      .toEqual(["BACK"]);
  });

  it("builds WooCommerce parent-product edit links", () => {
    expect(wooProductEditUrl(10)).toBe("https://naturalyield.com.au/wp-admin/post.php?post=10&action=edit");
    expect(wooProductEditUrl(0)).toBeNull();
  });
});
