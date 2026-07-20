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
import {
  getStockBackfillDiagnostics,
  purgeStockLedger,
  runStockBackfill,
  StockBackfillDiagnostics,
  StockBackfillRunResponse,
  triggerDataSync
} from "../api/adminApi";

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<StockBackfillDiagnostics | null>(null);
  const [backfillResult, setBackfillResult] = useState<StockBackfillRunResponse | null>(null);

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
