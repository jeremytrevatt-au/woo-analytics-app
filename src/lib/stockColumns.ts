import type { TableColumn } from "../types/analytics";

export const stockActionsColumn: TableColumn = {
  key: "actions",
  label: "Actions",
  type: "node",
};

export function getVisibleStockColumns(
  configurableColumns: TableColumn[],
  visibleColumnKeys: string[],
): TableColumn[] {
  return [
    stockActionsColumn,
    ...configurableColumns.filter((column) => visibleColumnKeys.includes(column.key)),
  ];
}
