with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

import_str = """import { useState, SyntheticEvent } from "react";
import { Stack, Typography, Grid, TextField, MenuItem, Tabs, Tab, Box } from "@mui/material";"""
content = content.replace('import { useState } from "react";\nimport { Stack, Typography, Grid, TextField, MenuItem } from "@mui/material";', import_str)

tab_state = """function StockPage() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const [page, setPage] = useState(1);"""
content = content.replace("""function StockPage() {
  const [page, setPage] = useState(1);""", tab_state)

ui_start = """      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="stock tabs">
          <Tab label="Stock Records" />
          <Tab label="Stock Shortages & Affected Orders" />
          <Tab label="Stock Reorder Forecast" />
          <Tab label="Stock Movement Ledger" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <LoadStateBlock
          loading={isLoading}
          error={error}
          onRetry={() => setPage(page)}
        >
          {rows && (
            <DataTablePanel
              title="Stock Records"
              columns={columns}
              data={rows}
              total={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          )}
        </LoadStateBlock>
      )}

      {activeTab === 1 && (
        <LoadStateBlock
          loading={stockShortages.isLoading}
          error={stockShortages.error}
          onRetry={() => setShortagesPage(shortagesPage)}
        >
          {stockShortages.data && (
            <DataTablePanel
              title="Stock Shortages & Affected Orders"
              columns={shortagesColumns}
              data={stockShortages.data.items}
              total={stockShortages.data.total}
              page={shortagesPage}
              pageSize={50}
              onPageChange={setShortagesPage}
              onPageSizeChange={() => {}}
              expandable
              renderExpandedRow={(row) => {
                const orders = row.affected_orders as any[];
                if (!orders || orders.length === 0) return null;
                return (
                  <Table size="small" aria-label="affected orders">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order ID</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Missing Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((o: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{o.order_id}</TableCell>
                          <TableCell>{new Date(o.order_date).toLocaleDateString("en-AU")}</TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell>{o.order_status}</TableCell>
                          <TableCell>{o.missing_qty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              }}
            />
          )}
        </LoadStateBlock>
      )}

      {activeTab === 2 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Lead Time (Days)"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                size="small"
              />
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
            loading={stockForecast.isLoading}
            error={stockForecast.error}
            onRetry={() => setForecastPage(forecastPage)}
          >
            {stockForecast.data && (
              <DataTablePanel
                title="Stock Reorder Forecast"
                columns={forecastColumns}
                data={stockForecast.data.items}
                total={stockForecast.data.total}
                page={forecastPage}
                pageSize={20}
                onPageChange={setForecastPage}
                onPageSizeChange={() => {}}
                expandable
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
                                <a href={https://naturalyield.com.au/wp-admin/post.php?post=&action=edit} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
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
            )}
          </LoadStateBlock>
        </>
      )}

      {activeTab === 3 && (
        <>
          <Box sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
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
                  change_amount: i.change_amount > 0 ? + : i.change_amount,
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
      )}"""

# We need to replace everything from the first LoadStateBlock to the end
import re
pattern = re.compile(r'<LoadStateBlock\s*loading=\{isLoading\}.*?</Stack>', re.DOTALL)
content = pattern.sub(ui_start + '\n    </Stack>', content)

# Also remove the Grid for forecast controls that was above the first LoadStateBlock
grid_pattern = re.compile(r'<Grid container spacing=\{2\} sx=\{\{ mb: 3 \}\}>.*?</Grid>\s*<LoadStateBlock', re.DOTALL)
content = grid_pattern.sub('<LoadStateBlock', content)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
