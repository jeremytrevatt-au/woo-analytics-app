import { useState } from "react";
import { Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatCurrency } from "../lib/format";

function OrdersPage() {
  const [page, setPage] = useState(1);
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("orders", page, 50);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Orders
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Monitor order flow by status, units sold, and revenue concentration.
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error ? (
        <>
          <KpiGrid cards={kpis.slice(0, 2)} />
          <TrendsChartPanel title="Orders Trend" data={trends} domain="orders" />
          <DataTablePanel
            title="Orders Records"
            rows={rows as any}
            columns={columns}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            getLinkUrl={(row, col) => col.key === "order_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.order_id}&action=edit` : null}
            renderExpandedRow={(row) => {
              const lines = row.lines as any[];
              if (!lines || lines.length === 0) return <Typography variant="body2">No line items found.</Typography>;
              return (
                <Table size="small" aria-label="purchases">
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((line: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell component="th" scope="row">
                          {line.sku || "N/A"}
                        </TableCell>
                        <TableCell>{line.category || "N/A"}</TableCell>
                        <TableCell align="right">{line.qty}</TableCell>
                        <TableCell align="right">{formatCurrency(line.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            }}
          />
        </>
      ) : null}
    </Stack>
  );
}

export default OrdersPage;
