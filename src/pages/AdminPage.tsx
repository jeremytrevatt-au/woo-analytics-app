import { useState } from "react";
import { Box, Button, Typography, Paper, CircularProgress, Alert } from "@mui/material";
import { triggerDataSync } from "../api/adminApi";

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Trigger Global Re-Sync"}
          </Button>
        </Box>

        {result && (
          <Alert severity={result.type} sx={{ mt: 3 }}>
            {result.message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default AdminPage;
