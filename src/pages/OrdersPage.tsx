import { useState } from "react";
import { Stack, Typography, Table, TableHead, TableRow, TableCell, TableBody, Box, Button } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import AddToPOModal from "../components/AddToPOModal";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatCurrency } from "../lib/format";

function OrdersPage() {
  const [page, setPage] = useState(1);
  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("orders", page, 50);

  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [addToPoModalOpen, setAddToPoModalOpen] = useState(false);

  const handleAddToPoSuccess = (saved: boolean) => {
    setAddToPoModalOpen(false);
    if (saved) {
      setSelectedOrders([]);
    }
  };

  // Flatten selected orders' lines into a single array of items
  const selectedLineItems = selectedOrders.flatMap(order => 
    (order.lines || []).map((line: any) => ({
      product_id: line.product_id,
      sku: line.sku,
      product_name: line.product_name || line.sku, // orders API might not return product_name in lines, we fallback to sku
      qty: line.qty
    }))
  );

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
          
          <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button 
              variant="outlined" 
              disabled={selectedOrders.length === 0}
              onClick={() => setAddToPoModalOpen(true)}
            >
              Add Items to PO ({selectedLineItems.length} items)
            </Button>
          </Box>

          <DataTablePanel
            title="Orders Records"
            rows={rows as any}
            columns={columns}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            selectable
            selectedRows={selectedOrders}
            onSelectionChange={setSelectedOrders}
            rowIdKey="order_id"
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
                      <TableCell>ETA</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((line: any, idx: number) => {
                      let etaText = "-";
                      if (line.nya_stock_eta) {
                        etaText = new Date(line.nya_stock_eta).toLocaleDateString("en-AU");
                      } else if (line.nya_default_lead_time) {
                        const etaDate = new Date();
                        etaDate.setDate(etaDate.getDate() + line.nya_default_lead_time);
                        etaText = etaDate.toLocaleDateString("en-AU") + " (Est)";
                      }
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell component="th" scope="row">
                            {line.sku || "N/A"}
                          </TableCell>
                          <TableCell>{line.category || "N/A"}</TableCell>
                          <TableCell align="right">{line.qty}</TableCell>
                          <TableCell align="right">{formatCurrency(line.line_total)}</TableCell>
                          <TableCell>{etaText}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            }}
          />
        </>
      ) : null}

      {addToPoModalOpen && (
        <AddToPOModal
          open={addToPoModalOpen}
          onClose={handleAddToPoSuccess}
          selectedItems={selectedLineItems}
        />
      )}
    </Stack>
  );
}

export default OrdersPage;
