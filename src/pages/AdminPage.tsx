import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import ProductSearchAutocomplete from "../components/ProductSearchAutocomplete";
import { ProductSearchResult } from "../api/productsApi";
import {
  getStockBackfillDiagnostics,
  getStockIdentityReviewRows,
  purgeStockLedger,
  runStockBackfill,
  StockBackfillDiagnostics,
  StockBackfillRunResponse,
  StockIdentityReviewAction,
  StockIdentityReviewResponse,
  triggerDataSync,
  updateStockIdentityReviewRow
} from "../api/adminApi";

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<StockBackfillDiagnostics | null>(null);
  const [backfillResult, setBackfillResult] = useState<StockBackfillRunResponse | null>(null);
  const [identityReview, setIdentityReview] = useState<StockIdentityReviewResponse | null>(null);
  const [identityReviewPage, setIdentityReviewPage] = useState(1);
  const [remapTargets, setRemapTargets] = useState<Record<string, ProductSearchResult | null>>({});

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await triggerDataSync();
      setResult({ type: "success", message: response.message });
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to trigger sync" });
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    setResult(null);
    setPurgeDialogOpen(false);
    try {
      const response = await purgeStockLedger();
      setResult({ type: "success", message: response.message });
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to purge ledger" });
    } finally {
      setPurging(false);
    }
  };

  const handleLoadDiagnostics = async () => {
    setBackfillLoading(true);
    setResult(null);
    try {
      const response = await getStockBackfillDiagnostics();
      setDiagnostics(response);
      setResult({ type: "success", message: "Loaded stock backfill diagnostics." });
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to load stock backfill diagnostics" });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleBackfillRun = async (dryRun: boolean) => {
    setBackfillLoading(true);
    setResult(null);
    try {
      const response = await runStockBackfill(dryRun);
      setBackfillResult(response);
      if (response.diagnostics) {
        setDiagnostics(response.diagnostics);
      } else {
        setDiagnostics(await getStockBackfillDiagnostics());
      }
      setResult({
        type: "success",
        message: dryRun
          ? `Dry run ${response.run_id} completed.`
          : `Historical stock backfill ${response.run_id} completed.`
      });
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to run stock backfill" });
    } finally {
      setBackfillLoading(false);
    }
  };

  const loadIdentityReviewRows = async (page = identityReviewPage) => {
    setBackfillLoading(true);
    setResult(null);
    try {
      const response = await getStockIdentityReviewRows("review_required", page, 50);
      setIdentityReview(response);
      setIdentityReviewPage(page);
      setResult({ type: "success", message: `Loaded ${response.records.length} SKU identity review rows.` });
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to load SKU identity review rows" });
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleIdentityReviewAction = async (
    productId: number,
    normalizedSku: string,
    action: StockIdentityReviewAction,
    targetProduct?: ProductSearchResult | null
  ) => {
    setBackfillLoading(true);
    setResult(null);
    try {
      const response = await updateStockIdentityReviewRow(
        productId,
        normalizedSku,
        action,
        undefined,
        targetProduct?.id,
        targetProduct?.wsvi_group_id
      );
      setResult({
        type: "success",
        message: `Review ${action} saved. Included movement rows: ${response.movement_metrics?.included_rows ?? 0}.`
      });
      await loadIdentityReviewRows(identityReviewPage);
      setDiagnostics(await getStockBackfillDiagnostics());
    } catch (err: any) {
      setResult({ type: "error", message: err.message || "Failed to update SKU identity review row" });
    } finally {
      setBackfillLoading(false);
    }
  };

  const renderSummaryTable = (title: string, rows?: Array<Record<string, unknown>>) => {
    if (!rows || rows.length === 0) {
      return null;
    }
    const keys = Object.keys(rows[0]);
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              {keys.map((key) => (
                <TableCell key={key}>{key}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {keys.map((key) => (
                  <TableCell key={key}>{String(row[key] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Administration
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3, maxWidth: 600 }}>
        <Typography variant="h6" gutterBottom>
          Data Synchronization
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Trigger a manual sync of all data from the WooCommerce database into the BigQuery reporting tables.
          This process runs in the background and may take a minute to complete.
        </Typography>
        
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSync} 
            disabled={loading || purging}
          >
            {loading ? <CircularProgress size={24} /> : "Trigger Global Re-Sync"}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 3, maxWidth: 1100 }}>
        <Typography variant="h6" gutterBottom>
          Historical Stock Backfill
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Build reviewed SKU identity mappings and a separate order-line-derived stock movement dataset for forecasting.
          Dry runs produce diagnostics only; applying the backfill replaces the derived reporting tables, not the live stock ledger.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={handleLoadDiagnostics} disabled={backfillLoading}>
            Load Diagnostics
          </Button>
          <Button variant="outlined" onClick={() => handleBackfillRun(true)} disabled={backfillLoading}>
            Run Dry-Run
          </Button>
          <Button variant="contained" onClick={() => handleBackfillRun(false)} disabled={backfillLoading}>
            Apply Historical Backfill
          </Button>
          {backfillLoading ? <CircularProgress size={24} /> : null}
        </Stack>

        {backfillResult ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Run {backfillResult.run_id}: {backfillResult.status}
            {backfillResult.identity_rows !== undefined ? ` | identity rows: ${backfillResult.identity_rows}` : ""}
            {backfillResult.derived_rows !== undefined ? ` | derived rows: ${backfillResult.derived_rows}` : ""}
            {backfillResult.included_rows !== undefined ? ` | forecast rows: ${backfillResult.included_rows}` : ""}
            {backfillResult.low_confidence_rows !== undefined ? ` | review rows: ${backfillResult.low_confidence_rows}` : ""}
          </Alert>
        ) : null}

        {diagnostics ? (
          <Box sx={{ mt: 2, overflowX: "auto" }}>
            {renderSummaryTable("Order Line Coverage", diagnostics.order_line_summary)}
            {renderSummaryTable("SKU Identity Health", diagnostics.sku_identity_summary)}
            {renderSummaryTable("Live Ledger Overlap", diagnostics.ledger_overlap_summary)}
            {renderSummaryTable("Identity Bridge", diagnostics.identity_bridge_summary)}
            {renderSummaryTable("Derived Movements", diagnostics.derived_movement_summary)}
            {renderSummaryTable("Latest Backfill Runs", diagnostics.latest_runs)}
          </Box>
        ) : null}

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            SKU Identity Review
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Review low-confidence SKU/post-ID mappings before they influence forecasting. Each action rebuilds the derived movement table.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={() => loadIdentityReviewRows(1)} disabled={backfillLoading}>
              Load Review Rows
            </Button>
            {identityReview ? (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                Showing {identityReview.records.length} of {identityReview.total_count} rows requiring review.
              </Typography>
            ) : null}
          </Stack>
          {identityReview && identityReview.records.length > 0 ? (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product ID</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Woo</TableCell>
                    <TableCell>Remap To Woo Product</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {identityReview.records.map((row) => {
                    const rowKey = `${row.product_id}:${row.normalized_sku}`;
                    return (
                      <TableRow key={rowKey}>
                        <TableCell>{row.product_id}</TableCell>
                        <TableCell>{row.sku || row.normalized_sku || "(missing)"}</TableCell>
                        <TableCell>{row.product_name || "-"}</TableCell>
                        <TableCell>{row.confidence_reason}</TableCell>
                        <TableCell align="right">{row.source_count}</TableCell>
                        <TableCell>
                          {row.first_seen_date || "-"} to {row.last_seen_date || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            href={`https://naturalyield.com.au/wp-admin/post.php?post=${row.product_id}&action=edit`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Woo
                          </Button>
                        </TableCell>
                        <TableCell sx={{ minWidth: 320 }}>
                          <ProductSearchAutocomplete
                            value={remapTargets[rowKey] || null}
                            onChange={(value) =>
                              setRemapTargets((previous) => ({
                                ...previous,
                                [rowKey]: value
                              }))
                            }
                            label="Search target SKU/product"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleIdentityReviewAction(row.product_id, row.normalized_sku, "approve")}
                              disabled={backfillLoading}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => handleIdentityReviewAction(row.product_id, row.normalized_sku, "exclude")}
                              disabled={backfillLoading}
                            >
                              Exclude
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleIdentityReviewAction(row.product_id, row.normalized_sku, "remap_product", remapTargets[rowKey])}
                              disabled={backfillLoading || !remapTargets[rowKey]}
                            >
                              Remap
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  disabled={backfillLoading || identityReviewPage <= 1}
                  onClick={() => loadIdentityReviewRows(identityReviewPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outlined"
                  disabled={backfillLoading || identityReviewPage * identityReview.page_size >= identityReview.total_count}
                  onClick={() => loadIdentityReviewRows(identityReviewPage + 1)}
                >
                  Next
                </Button>
              </Stack>
            </Box>
          ) : null}
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 3, maxWidth: 600, borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Danger Zone
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Purge the Stock Movement Ledger from BigQuery. Note: This does not delete the original records in the WooCommerce MySQL database. A global re-sync will restore them.
        </Typography>
        
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Button 
            variant="outlined" 
            color="error" 
            onClick={() => {
              if (window.confirm("Are you absolutely sure you want to purge the Stock Ledger?")) {
                setPurgeDialogOpen(true);
              }
            }} 
            disabled={loading || purging}
          >
            {purging ? <CircularProgress size={24} color="error" /> : "Purge Stock Ledger"}
          </Button>
        </Box>
      </Paper>

      {result && (
        <Alert severity={result.type} sx={{ mt: 3, maxWidth: 600 }}>
          {result.message}
        </Alert>
      )}

      <Dialog
        open={purgeDialogOpen}
        onClose={() => setPurgeDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" color="error">
          {"Purge Stock Movement Ledger?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to purge the Stock Movement Ledger from the Analytics reporting database? 
            <br /><br />
            This will clear the frontend tables immediately. However, because the Analytics service has read-only access to WooCommerce, it cannot delete the source records in MySQL. Running a Global Re-Sync later will pull the old records back in unless they are manually purged from MySQL.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePurge} color="error" autoFocus>
            Yes, Purge Ledger
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminPage;
