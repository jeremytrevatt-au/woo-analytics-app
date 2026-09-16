import { describe, expect, it } from "vitest";
import { filterCurrentStockRows } from "./stockProductSearch";

const rows = [
  { product_id: 1, sku: "PLAN-BLUE", product_name: "Blue Planter" },
  { product_id: 2, sku: "STAND-01", product_name: "Planter Stand", child_skus: "STAND-01-L STAND-01-S" },
];

describe("filterCurrentStockRows", () => {
  it("filters the current result set by SKU", () => {
    expect(filterCurrentStockRows(rows, "blue")).toEqual([rows[0]]);
  });

  it("filters by product name or child SKU", () => {
    expect(filterCurrentStockRows(rows, "planter stand")).toEqual([rows[1]]);
    expect(filterCurrentStockRows(rows, "01-l")).toEqual([rows[1]]);
  });

  it("returns all rows for an empty query", () => {
    expect(filterCurrentStockRows(rows, "")).toEqual(rows);
  });
});
