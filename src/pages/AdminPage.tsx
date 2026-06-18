import { useState } from "react";
import { Box, Button, Typography, Paper, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import { triggerDataSync, purgeStockLedger } from "../api/adminApi";

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);

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
