import { Stack, Typography, Grid, Box, Chip } from "@mui/material";
import { useState } from "react";
import DataTablePanel from "../components/DataTablePanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatCurrency } from "../lib/format";

function BackordersPage() {
  const [page, setPage] = useState(1);
  const { rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("backorders", page, 50);

  const renderExpandedRow = (row: any) => {
    if (!row.lines || row.lines.length === 0) {
      return <Typography variant="body2" color="text.secondary">No line items found.</Typography>;
    }

    return (
      <Box sx={{ margin: 1, padding: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom component="div">
          Order Line Items
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={2}><Typography variant="caption" fontWeight="bold">SKU</Typography></Grid>
          <Grid item xs={3}><Typography variant="caption" fontWeight="bold">Category</Typography></Grid>
          <Grid item xs={1}><Typography variant="caption" fontWeight="bold">Qty</Typography></Grid>
          <Grid item xs={2}><Typography variant="caption" fontWeight="bold">Total</Typography></Grid>
          <Grid item xs={2}><Typography variant="caption" fontWeight="bold">Stock Status</Typography></Grid>
          <Grid item xs={2}><Typography variant="caption" fontWeight="bold">Stock Qty</Typography></Grid>
        </Grid>
        {row.lines.map((line: any, idx: number) => (
          <Grid container spacing={2} key={idx} sx={{ mt: 0.5, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
            <Grid item xs={2}><Typography variant="body2">{line.sku}</Typography></Grid>
            <Grid item xs={3}><Typography variant="body2" noWrap title={line.category}>{line.category}</Typography></Grid>
            <Grid item xs={1}><Typography variant="body2">{line.qty}</Typography></Grid>
            <Grid item xs={2}><Typography variant="body2">{formatCurrency(line.line_total)}</Typography></Grid>
            <Grid item xs={2}>
              <Chip 
                size="small" 
                label={line.stock_status || 'unknown'} 
                color={
                  line.stock_status === 'instock' ? 'success' : 
                  line.stock_status === 'onbackorder' ? 'warning' : 
                  line.stock_status === 'outofstock' ? 'error' : 'default'
                }
              />
            </Grid>
            <Grid item xs={2}><Typography variant="body2">{line.stock_qty ?? '-'}</Typography></Grid>
          </Grid>
        ))}
      </Box>
    );
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Backorders
      </Typography>
      <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
      {!isLoading && !error && rows.length > 0 && (
        <DataTablePanel
          title="Orders with Backordered/Out-of-Stock Items"
          rows={rows as any}
          columns={columns}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          getLinkUrl={(row, col) => col.key === "order_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.order_id}&action=edit` : null}
          renderExpandedRow={renderExpandedRow}
        />
      )}
    </Stack>
  );
}

export default BackordersPage;
