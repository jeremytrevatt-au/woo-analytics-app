import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import {
  getSessionDaysOfCoverRequired,
  parseDaysOfCoverRequired,
  setSessionDaysOfCoverRequired,
} from "../lib/purchaseOrderAutoOrder";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (daysOfCoverRequired: number) => void;
};

export const AUTO_ORDER_HINT =
  "Recommended qty = ceil(max(0, D × (L + C) − S + B + P)). D is daily demand (forecast avg_daily_usage, or stock ÷ days of cover). L is lead time days. When D is 0, qty covers backorders + preorders only.";

export default function PurchaseOrderAutoOrderDialog({ open, onClose, onConfirm }: Props) {
  const [daysInput, setDaysInput] = useState("");

  useEffect(() => {
    if (!open) return;
    const last = getSessionDaysOfCoverRequired();
    setDaysInput(last ? String(last) : "");
  }, [open]);

  const daysOfCoverRequired = parseDaysOfCoverRequired(daysInput);
  const isValid = daysOfCoverRequired !== null;

  const handleConfirm = () => {
    if (daysOfCoverRequired === null) return;
    setSessionDaysOfCoverRequired(daysOfCoverRequired);
    onConfirm(daysOfCoverRequired);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" transitionDuration={0}>
      <DialogTitle>Auto Order</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {AUTO_ORDER_HINT}
        </Typography>
        <TextField
          autoFocus
          required
          fullWidth
          margin="dense"
          type="number"
          id="po-auto-order-days"
          label="Days of cover required"
          value={daysInput}
          onChange={(event) => setDaysInput(event.target.value)}
          error={Boolean(daysInput) && !isValid}
          helperText="Positive integer. Last value is remembered for this session."
          inputProps={{ min: 1, step: 1, "aria-label": "Days of cover required" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!isValid}>
          Apply recommended qty
        </Button>
      </DialogActions>
    </Dialog>
  );
}
