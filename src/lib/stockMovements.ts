import type {
  StockMovementCategory,
  StockMovementChartRecord,
} from "../types/analytics";

export type StockMovementFilter = "all" | StockMovementCategory;

export function filterStockMovements(
  records: StockMovementChartRecord[],
  filter: StockMovementFilter,
): StockMovementChartRecord[] {
  if (filter === "all") return records;
  return records.filter((record) => record.movement_category === filter);
}

export function summarizeStockMovements(records: StockMovementChartRecord[]) {
  return records.reduce(
    (summary, record) => {
      const change = Number(record.change_amount || 0);
      summary.movementCount += 1;
      if (change > 0) summary.stockInQty += change;
      if (change < 0) summary.stockOutQty += Math.abs(change);
      return summary;
    },
    {
      movementCount: 0,
      stockInQty: 0,
      stockOutQty: 0,
    },
  );
}
