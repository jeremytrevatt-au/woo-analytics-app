with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

import_str = """import { useStockForecast } from "../hooks/useStockForecast";"""
new_import_str = """import { useStockForecast } from "../hooks/useStockForecast";
import { useStockShortages } from "../hooks/useStockShortages";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";"""

content = content.replace(import_str, new_import_str)

hooks_str = """  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("stock", page, 50);
  const stockForecast = useStockForecast(forecastPage, 20, 90, method, lookbackDays);
  const stockKpi = kpis.find((item) => item.id === "stockAlerts");"""

new_hooks_str = """  const [shortagesPage, setShortagesPage] = useState(1);
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("stock", page, 50);
  const stockForecast = useStockForecast(forecastPage, 20, 90, method, lookbackDays);
  const stockShortages = useStockShortages(shortagesPage, 50);
  const stockKpi = kpis.find((item) => item.id === "stockAlerts");"""

content = content.replace(hooks_str, new_hooks_str)

shortages_panel = """
      <LoadStateBlock isLoading={stockShortages.isLoading} error={stockShortages.error} empty={!stockShortages.isLoading && !stockShortages.error && stockShortages.records.length === 0} />
      {!stockShortages.isLoading && !stockShortages.error && stockShortages.records.length > 0 ? (
        <DataTablePanel
          title="Stock Shortages & Affected Orders"
          rows={stockShortages.records}
          columns={stockShortages.columns}
          page={stockShortages.page}
          pageSize={stockShortages.pageSize}
          totalCount={stockShortages.totalCount}
          onPageChange={setShortagesPage}
          renderExpandedRow={(row) => {
            const orders = row.affected_orders as any[];
            if (!orders || orders.length === 0) return <Typography variant="body2">No affected orders found.</Typography>;
            return (
              <Table size="small" aria-label="affected-orders">
                <TableHead>
                  <TableRow>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((o: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{o.order_id}</TableCell>
                      <TableCell>{o.order_date}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{o.order_status}</TableCell>
                      <TableCell align="right">{o.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          }}
        />
      ) : null}
"""

grid_str = """      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>"""

content = content.replace(grid_str, shortages_panel + "\n" + grid_str)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
