import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Stack, Typography, Grid, TextField, MenuItem, Tabs, Tab, Box, Button } from "@mui/material";
import DataTablePanel from "../components/DataTablePanel";
import LoadStateBlock from "../components/LoadStateBlock";
import { useDashboardData } from "../hooks/useDashboardData";
import { useStockShortages } from "../hooks/useStockShortages";
import { useStockLedger } from "../hooks/useStockLedger";
import StockLedgerChartModal from "../components/StockLedgerChartModal";
import BulkUpdateModal from "../components/BulkUpdateModal";
import AddToPOModal from "../components/AddToPOModal";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { getStocktakeRecords, updateStockQuantity } from "../api/analyticsApi";
import { useFilters } from "../hooks/useFilters";

function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "shortages" ? 1 : searchParams.get("tab") === "stocktake" ? 2 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  const { filters } = useFilters();

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const tabValues = ["items", "shortages", "stocktake"];
    setSearchParams({ tab: tabValues[newValue] });
  };

  const [page, setPage] = useState(1);
  const [lookbackDays, setLookbackDays] = useState<number | "dynamic">(365);
  
  const [shortagesPage, setShortagesPage] = useState(1);
  const [stocktakePage, setStocktakePage] = useState(1);
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

  const { rows, columns, isLoading, error, totalCount, pageSize, refetch } = useDashboardData("stock", page, 50);
  const stockShortages = useStockShortages(shortagesPage, 50);
  const stockLedger = useStockLedger(1, 200, ledgerReason === "all" ? null : ledgerReason, ledgerSearch);

  const [selectedStockRecords, setSelectedStockRecords] = useState<any[]>([]);
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const [addToPoModalOpen, setAddToPoModalOpen] = useState(false);
  const [stocktakeRows, setStocktakeRows] = useState<any[]>([]);
  const [stocktakeColumns, setStocktakeColumns] = useState<any[]>([]);
  const [stocktakeTotalCount, setStocktakeTotalCount] = useState(0);
  const [stocktakeLoading, setStocktakeLoading] = useState(false);
  const [stocktakeError, setStocktakeError] = useState<string | null>(null);
  const [stocktakeInputs, setStocktakeInputs] = useState<Record<string, string>>({});
  const [stocktakeSaving, setStocktakeSaving] = useState<Record<string, boolean>>({});
  const [stocktakeMessages, setStocktakeMessages] = useState<Record<string, string>>({});

  const handleBulkUpdateSuccess = () => {
    setSelectedStockRecords([]);
    refetch();
    stockShortages.refetch();
  };

  const handleAddToPoSuccess = (saved: boolean) => {
    setAddToPoModalOpen(false);
    if (saved) {
      setSelectedStockRecords([]);
      // Optionally refetch or show success message
    }
  };

  useEffect(() => {
    if (activeTab !== 2) return;
    let isSubscribed = true;
    setStocktakeLoading(true);
    setStocktakeError(null);
    getStocktakeRecords(filters, stocktakePage, 50)
      .then((response) => {
        if (!isSubscribed) return;
        setStocktakeRows(response.records);
        setStocktakeColumns(response.columns || []);
        setStocktakeTotalCount(response.totalCount);
      })
      .catch((error: any) => {
        if (isSubscribed) setStocktakeError(error.message || "Failed to load stocktake rows.");
      })
      .finally(() => {
        if (isSubscribed) setStocktakeLoading(false);
      });
    return () => {
      isSubscribed = false;
    };
  }, [activeTab, filters, stocktakePage]);

  const refreshStocktake = async () => {
    setStocktakeLoading(true);
    setStocktakeError(null);
    try {
      const response = await getStocktakeRecords(filters, stocktakePage, 50);
      setStocktakeRows(response.records);
      setStocktakeColumns(response.columns || []);
      setStocktakeTotalCount(response.totalCount);
      refetch();
    } catch (error: any) {
      setStocktakeError(error.message || "Failed to refresh stocktake rows.");
    } finally {
      setStocktakeLoading(false);
    }
  };

  const handleStocktakeSave = async (row: any) => {
    const key = String(row.product_id);
    const value = stocktakeInputs[key];
    const nextQty = Number(value);
    if (!Number.isFinite(nextQty) || nextQty < 0) {
      setStocktakeMessages(prev => ({ ...prev, [key]: "Enter a stock quantity of 0 or higher." }));
      return;
    }
    setStocktakeSaving(prev => ({ ...prev, [key]: true }));
    setStocktakeMessages(prev => ({ ...prev, [key]: "Saving..." }));
    try {
      const response = await updateStockQuantity(Number(row.product_id), nextQty);
      setStocktakeInputs(prev => ({ ...prev, [key]: String(response.stock_qty ?? nextQty) }));
      setStocktakeMessages(prev => ({ ...prev, [key]: `Saved ${response.stock_qty ?? nextQty}` }));
      await refreshStocktake();
    } catch (error: any) {
      setStocktakeMessages(prev => ({ ...prev, [key]: error.message || "Failed to update stock." }));
    } finally {
      setStocktakeSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const unifiedRows = (rows as any[]).map((row) => {
    return {
      ...row,
      recent_movement_count: row.movement_count ?? 0,
      actions: (
        <Button size="small" variant="outlined" onClick={() => setSelectedSku({
          sku: row.sku,
          name: row.product_name,
          productId: row.product_id ? Number(row.product_id) : null,
          wsviGroupId: row.wsvi_group_id || null,
          canonicalProductKey: row.canonical_product_key || null,
        })}>
          Analyze
        </Button>
      ),
    };
  });
  const unifiedColumns = [
    ...columns,
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
          <Tab label="Stocktake" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          <LoadStateBlock isLoading={isLoading} error={error} empty={!isLoading && !error && rows.length === 0} />
          {!isLoading && !error ? (
              <>
                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      label="Forecast Average Window"
                      value={lookbackDays}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLookbackDays(value === "dynamic" ? "dynamic" : Number(value));
                      }}
                      size="small"
                    >
                      <MenuItem value={7}>Last 7 Days</MenuItem>
                      <MenuItem value={14}>Last 14 Days</MenuItem>
                      <MenuItem value={30}>Last 30 Days</MenuItem>
                      <MenuItem value={60}>Last 60 Days</MenuItem>
                      <MenuItem value={90}>Last 90 Days</MenuItem>
                      <MenuItem value={180}>Last 180 Days</MenuItem>
                      <MenuItem value={365}>Last 365 Days</MenuItem>
                      <MenuItem value="dynamic">Dynamic</MenuItem>
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
                  selectable
                  selectedRows={selectedStockRecords}
                  onSelectionChange={setSelectedStockRecords}
                  rowIdKey="product_id"
                  stickyHeader
                  maxHeight={720}
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
          <LoadStateBlock isLoading={stocktakeLoading} error={stocktakeError} empty={!stocktakeLoading && !stocktakeError && stocktakeRows.length === 0} />
          {!stocktakeLoading && !stocktakeError ? (
            <DataTablePanel
              title="Stocktake"
              rows={stocktakeRows.map((row: any) => {
                const key = String(row.product_id);
                const inputValue = stocktakeInputs[key] ?? "";
                return {
                  ...row,
                  new_qty: (
                    <Stack direction="row" spacing={1} alignItems="center" onClick={(event) => event.stopPropagation()}>
                      <TextField
                        size="small"
                        type="number"
                        value={inputValue}
                        placeholder={String(row.stock_qty ?? "")}
                        inputProps={{ min: 0, step: "any" }}
                        onChange={(event) => setStocktakeInputs(prev => ({ ...prev, [key]: event.target.value }))}
                        sx={{ width: 120 }}
                        disabled={row.manage_stock === false && !row.wsvi_group_id}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        disabled={stocktakeSaving[key] || inputValue === ""}
                        onClick={() => handleStocktakeSave(row)}
                      >
                        Save
                      </Button>
                      {stocktakeMessages[key] ? (
                        <Typography variant="caption" color={stocktakeMessages[key].startsWith("Saved") ? "success.main" : "text.secondary"}>
                          {stocktakeMessages[key]}
                        </Typography>
                      ) : null}
                    </Stack>
                  ),
                };
              })}
              columns={stocktakeColumns.map((column: any) => column.key === "new_qty" ? { ...column, type: "node" as const } : column)}
              page={stocktakePage}
              pageSize={50}
              totalCount={stocktakeTotalCount}
              onPageChange={setStocktakePage}
              getLinkUrl={(row, col) => col.key === "sku" ? `https://naturalyield.com.au/wp-admin/post.php?post=${row.parent_id || row.product_id}&action=edit` : null}
              stickyHeader
              maxHeight={720}
              rowIdKey="product_id"
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

      <StockLedgerChartModal
        sku={selectedSku?.sku || null}
        productName={selectedSku?.name || null}
        productId={selectedSku?.productId || null}
        wsviGroupId={selectedSku?.wsviGroupId || null}
        canonicalProductKey={selectedSku?.canonicalProductKey || null}
        lookbackDays={lookbackDays}
        startDate={filters.startDate}
        endDate={filters.endDate}
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
