import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
  Alert,
  CircularProgress
} from "@mui/material";
import { bulkUpdateStock } from "../api/analyticsApi";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedProducts: any[];
  onSuccess: () => void;
};

export default function BulkUpdateModal({ open, onClose, selectedProducts, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field states
  const [updateDefaultLeadTime, setUpdateDefaultLeadTime] = useState(false);
  const [defaultLeadTime, setDefaultLeadTime] = useState<number | "">("");

  const [updateReorderedDate, setUpdateReorderedDate] = useState(false);
  const [reorderedDate, setReorderedDate] = useState<string>("");

  const [updateLeadTime, setUpdateLeadTime] = useState(false);
  const [leadTime, setLeadTime] = useState<number | "">("");

  const [updateReorderQty, setUpdateReorderQty] = useState(false);
  const [reorderQty, setReorderQty] = useState<number | "">("");

  const [updateEta, setUpdateEta] = useState(false);
  const [eta, setEta] = useState<string>("");

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      setError("No products selected.");
      return;
    }

    const metaData: Record<string, any> = {};
    if (updateDefaultLeadTime) metaData._nya_default_lead_time = defaultLeadTime;
    if (updateReorderedDate) metaData._nya_stock_reordered_date = reorderedDate;
    if (updateLeadTime) metaData._nya_stock_lead_time = leadTime;
    if (updateReorderQty) metaData._nya_stock_reorder_qty = reorderQty;
    if (updateEta) metaData._nya_stock_eta = eta;

    if (Object.keys(metaData).length === 0) {
      setError("No fields selected for update.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const productIds = selectedProducts.map(p => p.product_id);
      const res = await bulkUpdateStock(productIds, metaData);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || "Failed to update products.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during bulk update.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk Update Reorder Fields</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          You are about to update {selectedProducts.length} selected product(s).
          Check the fields you want to apply to all selected products.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={updateDefaultLeadTime} onChange={(e) => setUpdateDefaultLeadTime(e.target.checked)} />}
              label="Default Lead Time (Days)"
              sx={{ width: 250 }}
            />
            <TextField
              size="small"
              type="number"
              disabled={!updateDefaultLeadTime}
              value={defaultLeadTime}
              onChange={(e) => setDefaultLeadTime(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={updateReorderedDate} onChange={(e) => setUpdateReorderedDate(e.target.checked)} />}
              label="Reordered Date"
              sx={{ width: 250 }}
            />
            <TextField
              size="small"
              type="date"
              disabled={!updateReorderedDate}
              value={reorderedDate}
              onChange={(e) => setReorderedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={updateLeadTime} onChange={(e) => setUpdateLeadTime(e.target.checked)} />}
              label="Active Lead Time (Days)"
              sx={{ width: 250 }}
            />
            <TextField
              size="small"
              type="number"
              disabled={!updateLeadTime}
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={updateReorderQty} onChange={(e) => setUpdateReorderQty(e.target.checked)} />}
              label="Reorder Qty"
              sx={{ width: 250 }}
            />
            <TextField
              size="small"
              type="number"
              disabled={!updateReorderQty}
              value={reorderQty}
              onChange={(e) => setReorderQty(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={updateEta} onChange={(e) => setUpdateEta(e.target.checked)} />}
              label="ETA Date"
              sx={{ width: 250 }}
            />
            <TextField
              size="small"
              type="date"
              disabled={!updateEta}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || selectedProducts.length === 0}>
          {loading ? <CircularProgress size={24} /> : "Apply Updates"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}