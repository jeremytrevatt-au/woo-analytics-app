import { useState, SyntheticEvent } from "react";
import { Stack, Typography, Grid, TextField, MenuItem, Tabs, Tab, Box } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import TrendsChartPanel from "../components/TrendsChartPanel";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStockForecast } from "../hooks/useStockForecast";
import { useStockShortages } from "../hooks/useStockShortages";
import { useStockLedger } from "../hooks/useStockLedger";
import { Table, TableBody, TableCell, TableHead, TableRow, Box } from "@mui/material";

function StockPage() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const [page, setPage] = useState(1);
  const [forecastPage, setForecastPage] = useState(1);
  const [method, setMethod] = useState("sma");
  const [lookbackDays, setLookbackDays] = useState(365);
  
  const [shortagesPage, setShortagesPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReason, setLedgerReason] = useState<string>("all");

  const { kpis, trends, rows, columns, isLoading, error, totalCount, pageSize } = useDashboardData("stock", page, 50);
  const stockForecast = useStockForecast(forecastPage, 20, 90, method, lookbackDays);
  const stockShortages = useStockShortages(shortagesPage, 50);
  const stockLedger = useStockLedger(ledgerPage, 50, ledgerReason === "all" ? null : ledgerReason);
  const stockKpi = kpis.find((item) => item.id === "stockAlerts");

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Stock
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Track out-of-stock risk and stock movement by SKU and product line.
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="stock tabs">
          <Tab label="Stock Records" />
          <Tab label="Stock Shortages & Affected Orders" />
          <Tab label="Stock Reorder Forecast" />
          <Tab label="Stock Movement Ledger" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
          {!isLoading && !error ? (
            <>
              <KpiGrid cards={stockKpi ? [stockKpi] : []} />
              <TrendsChartPanel title="Stock Trend" data={trends} domain="stock" />
              <DataTablePanel
                title="Stock Records"
                rows={rows as any}
                columns={columns}
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                getLinkUrl={(row, col) => col.key === "product_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
              />
            </>
          ) : null}
        </>
      )}

      {activeTab === 1 && (
        <>
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
                      <TableCell>{new Date(o.order_date).toLocaleDateString("en-AU")}</TableCell>
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
      </>
      )}

      {activeTab === 2 && (
        <>
      <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight={700}>
            Stock Reorder Forecast (90 day lead time)
          </Typography>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Forecasting Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            size="small"
          >
            <MenuItem value="sma">Simple Moving Average</MenuItem>
            <MenuItem value="ema">Exponential Moving Average</MenuItem>
            <MenuItem value="linear">Linear Regression</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            select
            label="Lookback Period"
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            size="small"
          >
            <MenuItem value={30}>Last 30 Days</MenuItem>
            <MenuItem value={60}>Last 60 Days</MenuItem>
            <MenuItem value={90}>Last 90 Days</MenuItem>
            <MenuItem value={180}>Last 180 Days</MenuItem>
            <MenuItem value={365}>Last 365 Days</MenuItem>
          </TextField>
        </Grid>
      </Grid>
      
      <LoadStateBlock
        isLoading={stockForecast.isLoading}
        error={stockForecast.error}
        empty={!stockForecast.isLoading && !stockForecast.error && stockForecast.records.length === 0}
      />
      {!stockForecast.isLoading && !stockForecast.error ? (
          <DataTablePanel
            title=""
            rows={stockForecast.records as any}
              columns={[
                { key: "base_sku", label: "Base SKU", type: "string" },
                { key: "product_name", label: "Product Name", type: "string" },
                { key: "category", label: "Category", type: "string" },
                { key: "min_days_of_cover", label: "Min Days of Cover", type: "number" },
                { key: "any_reorder", label: "Needs Reorder (Any)", type: "boolean" },
              ]}
            page={stockForecast.page}
            pageSize={stockForecast.pageSize}
            totalCount={stockForecast.totalCount}
            onPageChange={setForecastPage}
            renderExpandedRow={(row) => {
              const variants = row.variants as any[];
              if (!variants || variants.length === 0) return null;
              return (
                <Table size="small" aria-label="variants">
                  <TableHead>
                      <TableRow>
                        <TableCell>Variant SKU</TableCell>
                        <TableCell>Product Name</TableCell>
                        <TableCell align="right">Current Stock</TableCell>
                        <TableCell align="right">Avg Daily Usage</TableCell>
                        <TableCell align="right">Days of Cover</TableCell>
                        <TableCell>Projected Stockout</TableCell>
                        <TableCell>Incoming Qty</TableCell>
                        <TableCell>ETA</TableCell>
                        <TableCell>Needs Reorder</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {variants.map((v: any, idx: number) => {
                        let needsReorder = v.reorder_within_lead_time ? "Yes" : "No";
                        if (v.reorder_within_lead_time && v.nya_stock_reorder_qty > 0 && v.nya_stock_eta) {
                          const etaDate = new Date(v.nya_stock_eta);
                          const stockoutDate = new Date(v.projected_stockout_date);
                          if (etaDate <= stockoutDate) {
                            needsReorder = "Incoming";
                          }
                        }
                        return (
                        <TableRow key={idx}>
                          <TableCell>
                            <a href={`https://naturalyield.com.au/wp-admin/post.php?post=${v.product_id}&action=edit`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                              {v.sku}
                            </a>
                          </TableCell>
                          <TableCell>{v.product_name}</TableCell>
                          <TableCell align="right">{v.current_stock_qty}</TableCell>
                          <TableCell align="right">{v.avg_daily_usage?.toFixed(2)}</TableCell>
                          <TableCell align="right">{v.days_of_cover?.toFixed(1)}</TableCell>
                          <TableCell>{v.projected_stockout_date ? new Date(v.projected_stockout_date).toLocaleDateString("en-AU") : "-"}</TableCell>
                          <TableCell>{v.nya_stock_reorder_qty || "-"}</TableCell>
                          <TableCell>{v.nya_stock_eta ? new Date(v.nya_stock_eta).toLocaleDateString("en-AU") : "-"}</TableCell>
                          <TableCell>{needsReorder}</TableCell>
                        </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
            );
          }}
        />
      ) : null}
      </>
      )}

      {activeTab === 3 && (
        <>
      <Box sx={{ mt: 4, mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <Typography variant="h6">Stock Movement Ledger</Typography>
        <TextField
          select
          label="Reason"
          value={ledgerReason}
          onChange={(e) => {
            setLedgerReason(e.target.value);
            setLedgerPage(1);
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Movements</MenuItem>
          <MenuItem value="manual_edit">Manual Edit</MenuItem>
          <MenuItem value="order_placed">Order Placed</MenuItem>
          <MenuItem value="order_restocked">Order Restocked</MenuItem>
          <MenuItem value="order_refunded">Order Refunded</MenuItem>
        </TextField>
      </Box>

      <LoadStateBlock
        loading={stockLedger.isLoading}
        error={stockLedger.error}
        onRetry={() => setLedgerPage(ledgerPage)}
      >
        {stockLedger.data && (
          <DataTablePanel
            title="Stock Movement History"
            columns={[
              { field: "timestamp", headerName: "Date/Time" },
              { field: "sku", headerName: "SKU" },
              { field: "product_name", headerName: "Product Name" },
              { field: "reason", headerName: "Reason" },
              { field: "change_amount", headerName: "Change" },
              { field: "new_stock_level", headerName: "New Level" },
              { field: "reference_id", headerName: "Ref ID (Order)" },
            ]}
            data={stockLedger.data.items.map((i: any) => ({
              ...i,
              timestamp: new Date(i.timestamp).toLocaleString("en-AU"),
              change_amount: i.change_amount > 0 ? `+${i.change_amount}` : i.change_amount,
              reference_id: i.reference_id > 0 ? i.reference_id : "-",
            }))}
            total={stockLedger.data.total}
            page={ledgerPage}
            pageSize={50}
            onPageChange={setLedgerPage}
            onPageSizeChange={() => {}}
          />
        )}
      </LoadStateBlock>
      </>
      )}

    </Stack>
  );
}

export default StockPage;
