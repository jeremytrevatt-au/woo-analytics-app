import { describe, expect, it } from "vitest";
import type { StockMovementChartRecord } from "../types/analytics";
import { filterStockMovements, summarizeStockMovements } from "./stockMovements";

const records: StockMovementChartRecord[] = [
  {
    timestamp: "2026-09-01 00:00:00",
    stock_qty: null,
    change_amount: -2,
    reason: "order_placed",
    reference_id: 1,
    order_number: "1",
    source: "historical_orders",
    movement_category: "orders_out",
    sku: "SKU-1",
  },
  {
    timestamp: "2026-09-02 00:00:00",
    stock_qty: 12,
    change_amount: 10,
    reason: "po_received_stock",
    reference_id: 7,
    order_number: null,
    source: "live_ledger",
    movement_category: "stock_arrivals",
    sku: "SKU-1",
  },
];

describe("stock movement helpers", () => {
  it("filters movement categories without changing the source data", () => {
    expect(filterStockMovements(records, "orders_out")).toEqual([records[0]]);
    expect(filterStockMovements(records, "all")).toEqual(records);
  });

  it("keeps stock in positive and reports stock out as an absolute quantity", () => {
    expect(summarizeStockMovements(records)).toEqual({
      movementCount: 2,
      stockInQty: 10,
      stockOutQty: 2,
    });
  });
});
