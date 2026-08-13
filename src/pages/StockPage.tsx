import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Stack, Typography, Grid, TextField, MenuItem, Tabs, Tab, Box, Button } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import KpiGrid from "../components/KpiGrid";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStockForecast } from "../hooks/useStockForecast";
import { useStockShortages } from "../hooks/useStockShortages";
import { useStockLedger } from "../hooks/useStockLedger";
import StockLedgerChartModal from "../components/StockLedgerChartModal";
import BulkUpdateModal from "../components/BulkUpdateModal";
import AddToPOModal from "../components/AddToPOModal";
import { Alert, Dialog, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { getStockForecastHistory } from "../api/analyticsApi";
import { StockForecastHistoryResponse } from "../types/analytics";

function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "shortages" ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const tabValues = ["items", "shortages"];
    setSearchParams({ tab: tabValues[newValue] });
  };

  const [page, setPage] = useState(1);
  const [forecastPage, setForecastPage] = useState(1);
  const [method, setMethod] = useState("sma");
  const [lookbackDays, setLookbackDays] = useState(365);
  
  const [shortagesPage, setShortagesPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReason, setLedgerReason] = useState<string>("all");
  const [ledgerSearch, setLedgerSearch] = useState<string>("");
  const [selectedSku, setSelectedSku] = useState<{
    sku: string;
    name: string;
    productId?: number | null;
    wsviGroupId?: string | null;
    canonicalProductKey?: string | null;
  } | null>(null);
  const [forecastHistory, setForecastHistory] = useState<StockForecastHistoryResponse | null>(null);
  const [forecastHistoryLoading, setForecastHistoryLoading] = useState(false);
  const [forecastHistoryError, setForecastHistoryError] = useState<string | null>(null);

  const { kpis, rows, columns, isLoading, error, totalCount, pageSize, refetch } = useDashboardData("stock", page, 50);
  const stockForecast = useStockForecast(1, 200, 90, method, lookbackDays);
  const stockShortages = useStockShortages(shortagesPage, 50);
  const stockLedger = useStockLedger(1, 200, ledgerReason === "all" ? null : ledgerReason, ledgerSearch);
  const stockKpi = kpis.find((item) => item.id === "stockAlerts");

  const [selectedStockRecords, setSelectedStockRecords] = useState<any[]>([]);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const [addToPoModalOpen, setAddToPoModalOpen] = useState(false);

  const handleBulkUpdateSuccess = () => {
    setSelectedStockRecords([]);
    refetch();
    stockForecast.refetch();
    stockShortages.refetch();
  };

  const handleAddToPoSuccess = (saved: boolean) => {
    setAddToPoModalOpen(false);
    if (saved) {
      setSelectedStockRecords([]);
      // Optionally refetch or show success message
    }
  };

  const handleViewForecastHistory = async (variant: any) => {
    setForecastHistoryLoading(true);
    setForecastHistoryError(null);
    try {
      const response = await getStockForecastHistory(
        lookbackDays,
        variant.canonical_product_key,
        variant.sku
      );
      setForecastHistory(response);
    } catch (error: any) {
      setForecastHistoryError(error.message || "Failed to load forecast history.");
    } finally {
      setForecastHistoryLoading(false);
    }
  };

  const forecastVariants = stockForecast.records.flatMap((record: any) => record.variants || []);
  const ledgerItems = stockLedger.data?.items || [];
  const findForecastVariant = (row: any) => forecastVariants.find((variant: any) => variant.product_id === row.product_id || variant.sku === row.sku);
  const findLedgerEntries = (row: any) => ledgerItems.filter((item: any) => (
    (row.wsvi_group_id && item.wsvi_group_id === row.wsvi_group_id)
    || item.product_id === row.product_id
    || item.variation_id === row.product_id
    || item.sku === row.sku
  )).slice(0, 10);
  const unifiedRows = (rows as any[]).map((row) => {
    const forecast = findForecastVariant(row);
    const movementEntries = findLedgerEntries(row);
    return {
      ...row,
      avg_daily_usage: forecast?.avg_daily_usage ?? null,
      days_of_cover: forecast?.days_of_cover ?? null,
      forecast_source: forecast?.forecast_source ?? "insufficient_history",
      reorder_within_lead_time: forecast?.reorder_within_lead_time ?? false,
      projected_stockout_date: forecast?.projected_stockout_date ?? null,
      latest_movement: movementEntries[0]?.timestamp || null,
      recent_movement_count: movementEntries.length,
      actions: (
        <Button size="small" variant="outlined" onClick={() => setSelectedSku({
          sku: row.sku,
          name: row.product_name,
          productId: row.product_id ? Number(row.product_id) : null,
          wsviGroupId: row.wsvi_group_id || null,
          canonicalProductKey: forecast?.canonical_product_key || null,
        })}>
          Drill Down
        </Button>
      ),
    };
  });
  const unifiedColumns = [
    ...columns,
    { key: "avg_daily_usage", label: "Avg Daily Usage", type: "number" as const },
    { key: "days_of_cover", label: "Days of Cover", type: "number" as const },
    { key: "forecast_source", label: "Forecast Source", type: "string" as const },
    { key: "reorder_within_lead_time", label: "Needs Reorder", type: "boolean" as const },
    { key: "recent_movement_count", label: "Recent Movements", type: "number" as const },
    { key: "actions", label: "Actions", type: "node" as const },
  ];

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
          <Tab label="Stock Items" />
          <Tab label="Stock Shortages & Affected Orders" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
          {!isLoading && !error ? (
              <>
                <KpiGrid cards={stockKpi ? [stockKpi] : []} />
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
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
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Movement Search"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      label="Movement Reason"
                      value={ledgerReason}
                      onChange={(e) => setLedgerReason(e.target.value)}
                      size="small"
                    >
                      <MenuItem value="all">All Movements</MenuItem>
                      <MenuItem value="manual_edit">Manual Edit</MenuItem>
                      <MenuItem value="order_placed">Order Placed</MenuItem>
                      <MenuItem value="order_restocked">Order Restocked</MenuItem>
                      <MenuItem value="order_refunded">Order Refunded</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
                <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                  <Button 
                    variant="outlined" 
                    disabled={selectedStockRecords.length === 0}
                    onClick={() => setAddToPoModalOpen(true)}
                  >
                    Add to PO ({selectedStockRecords.length})
                  </Button>
                  <Button 
                    variant="contained" 
                    disabled={selectedStockRecords.length === 0}
                    onClick={() => setBulkUpdateModalOpen(true)}
                  >
                    Bulk Update Reorder Fields ({selectedStockRecords.length})
                  </Button>
                </Box>
                <DataTablePanel
                  title="Stock Items"
                  rows={unifiedRows as any}
                  columns={unifiedColumns}
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  onPageChange={setPage}
                  getLinkUrl={(row, col) => col.key === "product_id" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
                  renderExpandedRow={(row) => {
                    const forecast = findForecastVariant(row);
                    const movementEntries = findLedgerEntries(row);
                    return (
                      <Stack spacing={2}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
                          <Typography variant="subtitle2">Forecast and Movement Context</Typography>
                          <Button size="small" variant="outlined" onClick={() => setSelectedSku({
                            sku: row.sku,
                            name: row.product_name,
                            productId: row.product_id ? Number(row.product_id) : null,
                            wsviGroupId: row.wsvi_group_id || null,
                            canonicalProductKey: forecast?.canonical_product_key || null,
                          })}>
                            View Stock History & Forecast
                          </Button>
                        </Box>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Forecast Source</TableCell>
                              <TableCell align="right">Avg Daily Usage</TableCell>
                              <TableCell align="right">Days of Cover</TableCell>
                              <TableCell>Projected Stockout</TableCell>
                              <TableCell align="right">Historical Lines</TableCell>
                              <TableCell>History</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>{forecast?.forecast_source || "insufficient_history"}</TableCell>
                              <TableCell align="right">{forecast?.avg_daily_usage?.toFixed(2) || "-"}</TableCell>
                              <TableCell align="right">{forecast?.days_of_cover?.toFixed(1) || "-"}</TableCell>
                              <TableCell>{forecast?.projected_stockout_date ? new Date(forecast.projected_stockout_date).toLocaleDateString("en-AU") : "-"}</TableCell>
                              <TableCell align="right">{forecast?.historical_order_line_count ?? 0}</TableCell>
                              <TableCell>
                                {forecast ? (
                                  <Button size="small" variant="outlined" onClick={() => handleViewForecastHistory(forecast)}>
                                    View History
                                  </Button>
                                ) : "-"}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <Typography variant="subtitle2">Recent Stock Movements</Typography>
                        {movementEntries.length > 0 ? (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Date/Time</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell align="right">Change</TableCell>
                                <TableCell align="right">New Level</TableCell>
                                <TableCell>Order Ref</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {movementEntries.map((entry: any) => (
                                <TableRow key={entry.id}>
                                  <TableCell>{entry.timestamp}</TableCell>
                                  <TableCell>{entry.reason}</TableCell>
                                  <TableCell align="right">{entry.change_amount}</TableCell>
                                  <TableCell align="right">{entry.new_stock_level}</TableCell>
                                  <TableCell>{entry.reference_id || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No recent movement rows loaded for this item.</Typography>
                        )}
                      </Stack>
                    );
                  }}
                  selectable
                  selectedRows={selectedStockRecords}
                  onSelectionChange={setSelectedStockRecords}
                  rowIdKey="product_id"
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
              Stock Reorder Forecast
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
                { key: "forecast_sources", label: "Forecast Sources", type: "string" },
                { key: "historical_order_line_count", label: "Historical Lines", type: "number" },
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
                          <TableCell>Lead Time</TableCell>
                          <TableCell>Forecast Source</TableCell>
                          <TableCell align="right">Order Lines</TableCell>
                          <TableCell>Incoming Qty</TableCell>
                          <TableCell>ETA</TableCell>
                          <TableCell>Needs Reorder</TableCell>
                          <TableCell>History</TableCell>
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
                            <TableCell>{v.lead_time_days ? `${v.lead_time_days} days` : "-"}</TableCell>
                            <TableCell>{v.forecast_source || "unknown"}</TableCell>
                            <TableCell align="right">{v.historical_order_line_count ?? 0}</TableCell>
                            <TableCell>{v.nya_stock_reorder_qty || "-"}</TableCell>
                            <TableCell>{v.nya_stock_eta ? new Date(v.nya_stock_eta).toLocaleDateString("en-AU") : "-"}</TableCell>
                            <TableCell>{needsReorder}</TableCell>
                            <TableCell>
                              <Button size="small" variant="outlined" onClick={() => handleViewForecastHistory(v)}>
                                View
                              </Button>
                            </TableCell>
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
          label="Search SKU or Name"
          value={ledgerSearch}
          onChange={(e) => {
            setLedgerSearch(e.target.value);
            setLedgerPage(1);
          }}
          size="small"
          sx={{ minWidth: 250 }}
        />
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
        isLoading={stockLedger.isLoading}
        error={stockLedger.error}
        empty={!stockLedger.isLoading && !stockLedger.error && (!stockLedger.data || stockLedger.data.items.length === 0)}
      />
      {!stockLedger.isLoading && !stockLedger.error && stockLedger.data && stockLedger.data.items.length > 0 ? (
              <DataTablePanel
                title="Stock Movement History"
                  columns={[
                    { key: "timestamp", label: "Date/Time", type: "string" },
                    { key: "sku", label: "SKU", type: "string" },
                    { key: "product_name", label: "Product Name", type: "string" },
                    { key: "reason", label: "Reason", type: "string" },
                    { key: "change_amount", label: "Change", type: "string" },
                    { key: "new_stock_level", label: "New Level", type: "number" },
                    { key: "reference_id", label: "Ref ID (Order)", type: "string" },
                    { key: "actions", label: "Actions", type: "node" },
                  ]}
                rows={stockLedger.data.items.map((i: any) => {
                  let formattedDate = i.timestamp;
                  try {
                    // BigQuery sometimes returns dates as "YYYY-MM-DD HH:MM:SS" which Safari/Firefox fail to parse.
                    // Replace space with T to make it ISO 8601 compliant before parsing.
                    const isoString = i.timestamp.replace(' ', 'T');
                    formattedDate = new Date(isoString).toLocaleString("en-AU");
                  } catch (e) {
                    console.error("Date parsing error", e);
                  }
                  return {
                    ...i,
                    timestamp: formattedDate,
                    change_amount: i.change_amount > 0 ? `+${i.change_amount}` : i.change_amount,
                    reference_id: i.reference_id > 0 ? i.reference_id : "-",
                    actions: (
                      <Button 
                        size="small" 
                        variant="outlined" 
                        onClick={() => setSelectedSku({ sku: i.sku, name: i.product_name })}
                      >
                        View Chart
                      </Button>
                    ),
                  };
                })}
                totalCount={stockLedger.data.total}
                page={ledgerPage}
                pageSize={50}
                onPageChange={setLedgerPage}
              />
        ) : null}
        <StockLedgerChartModal 
          sku={selectedSku?.sku || null} 
          productName={selectedSku?.name || null} 
          onClose={() => setSelectedSku(null)} 
        />
        </>
      )}

      <Dialog
        open={Boolean(forecastHistory) || forecastHistoryLoading || Boolean(forecastHistoryError)}
        onClose={() => {
          setForecastHistory(null);
          setForecastHistoryError(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Forecast Movement History</DialogTitle>
        <DialogContent>
          {forecastHistoryLoading ? <Typography>Loading forecast history...</Typography> : null}
          {forecastHistoryError ? <Alert severity="error">{forecastHistoryError}</Alert> : null}
          {forecastHistory ? (
            <Box sx={{ overflowX: "auto" }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Showing reviewed historical order-line movements for {forecastHistory.sku || forecastHistory.canonical_product_key}.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Included Usage</TableCell>
                    <TableCell align="right">Excluded Qty</TableCell>
                    <TableCell align="right">Included Lines</TableCell>
                    <TableCell align="right">Excluded Lines</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecastHistory.points.map((point) => (
                    <TableRow key={`${point.movement_date}-${point.canonical_product_key}`}>
                      <TableCell>{new Date(point.movement_date).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>{point.sku}</TableCell>
                      <TableCell>{point.product_name}</TableCell>
                      <TableCell align="right">{point.forecast_usage_qty}</TableCell>
                      <TableCell align="right">{point.excluded_qty}</TableCell>
                      <TableCell align="right">{point.included_lines}</TableCell>
                      <TableCell align="right">{point.excluded_lines}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>

      <StockLedgerChartModal
        sku={selectedSku?.sku || null}
        productName={selectedSku?.name || null}
        productId={selectedSku?.productId || null}
        wsviGroupId={selectedSku?.wsviGroupId || null}
        canonicalProductKey={selectedSku?.canonicalProductKey || null}
        lookbackDays={lookbackDays}
        onClose={() => setSelectedSku(null)}
      />

      <BulkUpdateModal
        open={bulkUpdateModalOpen}
        onClose={() => setBulkUpdateModalOpen(false)}
        selectedProducts={selectedStockRecords}
        onSuccess={handleBulkUpdateSuccess}
      />
      {addToPoModalOpen && (
        <AddToPOModal
          open={addToPoModalOpen}
          onClose={handleAddToPoSuccess}
          selectedItems={selectedStockRecords}
        />
      )}
    </Stack>
  );
}

export default StockPage;
