import { describe, expect, it } from "vitest";
import { getVisibleStockColumns } from "./stockColumns";

describe("getVisibleStockColumns", () => {
  it("keeps Actions first even when saved preferences omit it", () => {
    const columns = getVisibleStockColumns(
      [
        { key: "sku", label: "SKU", type: "string" },
        { key: "stock_qty", label: "Stock", type: "number" },
      ],
      ["stock_qty"],
    );

    expect(columns.map((column) => column.key)).toEqual(["actions", "stock_qty"]);
  });
});
