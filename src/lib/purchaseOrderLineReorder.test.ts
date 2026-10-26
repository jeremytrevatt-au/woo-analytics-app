import { describe, expect, it } from "vitest";
import {
  applyLineSortOrder,
  moveSelectedLinesToBottom,
  moveSelectedLinesToTop,
  remapIndexesAfterDrag,
  remapIndexesAfterRemove,
  remapIndexesAfterSwap,
  selectedIndexesAfterMoveToBottom,
  selectedIndexesAfterMoveToTop,
  sortLinesBySku,
  sortLinesBySkuWithIndexMap,
} from "./purchaseOrderLineReorder";

const lines = [
  { sku: "C-SKU", name: "third" },
  { sku: "A-SKU", name: "first" },
  { sku: "B-SKU", name: "second" },
  { sku: "D-SKU", name: "fourth" },
];

describe("moveSelectedLinesToTop", () => {
  it("moves selected lines to the top and keeps relative order", () => {
    const reordered = moveSelectedLinesToTop(lines, [2, 0]);
    expect(reordered.map((line) => line.sku)).toEqual(["C-SKU", "B-SKU", "A-SKU", "D-SKU"]);
  });

  it("keeps unselected lines in their relative order", () => {
    const reordered = moveSelectedLinesToTop(lines, [3]);
    expect(reordered.map((line) => line.name)).toEqual(["fourth", "third", "first", "second"]);
  });

  it("is a no-op when nothing is selected", () => {
    expect(moveSelectedLinesToTop(lines, [])).toEqual(lines);
    expect(moveSelectedLinesToTop(lines, [-1, 99])).toEqual(lines);
  });
});

describe("moveSelectedLinesToBottom", () => {
  it("moves selected lines to the bottom and keeps relative order", () => {
    const reordered = moveSelectedLinesToBottom(lines, [0, 2]);
    expect(reordered.map((line) => line.sku)).toEqual(["A-SKU", "D-SKU", "C-SKU", "B-SKU"]);
  });

  it("keeps unselected lines in their relative order", () => {
    const reordered = moveSelectedLinesToBottom(lines, [1]);
    expect(reordered.map((line) => line.name)).toEqual(["third", "second", "fourth", "first"]);
  });

  it("is a no-op when nothing is selected", () => {
    expect(moveSelectedLinesToBottom(lines, [])).toEqual(lines);
    expect(moveSelectedLinesToBottom(lines, [undefined as unknown as number])).toEqual(lines);
  });
});

describe("sortLinesBySku", () => {
  it("sorts all lines by Woo SKU in natural A–Z order", () => {
    const mixed = [
      { sku: "GS-10" },
      { sku: "gs-2" },
      { sku: "GS-1" },
      { sku: "" },
      { sku: "ALPHA" },
    ];
    expect(sortLinesBySku(mixed).map((line) => line.sku)).toEqual([
      "",
      "ALPHA",
      "GS-1",
      "gs-2",
      "GS-10",
    ]);
  });

  it("keeps equal SKUs in their original relative order", () => {
    const duplicates = [
      { sku: "SAME", name: "first" },
      { sku: "Z", name: "z" },
      { sku: "SAME", name: "second" },
    ];
    expect(sortLinesBySku(duplicates).map((line) => line.name)).toEqual(["first", "second", "z"]);
  });

  it("returns an index map so selection can follow the sorted rows", () => {
    const { lines: sorted, indexMap } = sortLinesBySkuWithIndexMap(lines);
    expect(sorted.map((line) => line.sku)).toEqual(["A-SKU", "B-SKU", "C-SKU", "D-SKU"]);
    expect(indexMap.get(0)).toBe(2);
    expect(indexMap.get(1)).toBe(0);
  });
});

describe("applyLineSortOrder", () => {
  it("stamps 1-based sort_order from the current array order", () => {
    expect(applyLineSortOrder(lines).map((line) => line.sort_order)).toEqual([1, 2, 3, 4]);
  });
});

describe("selection remaps", () => {
  it("places moved-to-top selection at the start", () => {
    expect(selectedIndexesAfterMoveToTop([3, 1])).toEqual([0, 1]);
  });

  it("places moved-to-bottom selection at the end", () => {
    expect(selectedIndexesAfterMoveToBottom([0, 2], 4)).toEqual([2, 3]);
  });

  it("shifts indexes after a removed row", () => {
    expect(remapIndexesAfterRemove([0, 2, 3], 2)).toEqual([0, 2]);
  });

  it("swaps indexes for a single-row up/down move", () => {
    expect(remapIndexesAfterSwap([2], 2, 1)).toEqual([1]);
  });

  it("follows a dragged row to the drop index", () => {
    expect(remapIndexesAfterDrag([0, 3], 0, 2)).toEqual([2, 3]);
  });
});
