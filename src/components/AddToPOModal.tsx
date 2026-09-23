import { useState, useEffect } from "react";
import { Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, CircularProgress, Typography } from "@mui/material";
import { purchaseOrdersApi, PurchaseOrder } from "../api/purchaseOrdersApi";
import { mergePurchaseOrderLines, type StockPurchaseOrderSelection } from "../lib/addToPurchaseOrder";

type Props = {
  open: boolean;
  onClose: (saved: boolean) => void;
  selectedItems: StockPurchaseOrderSelection[];
};

export default function AddToPOModal({ open, onClose, selectedItems }: Props) {
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("new");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setRequestError(null);
      purchaseOrdersApi.list("draft")
        .then(data => setPos(data))
        .catch(err => setRequestError(err instanceof Error ? err.message : "Failed to load draft purchase orders."))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleSave = async () => {
    const blockedVariableParents = selectedItems.filter((item) => (item.product_type || item.type) === "variable" && !item.wsvi_group_id);
    if (blockedVariableParents.length > 0) {
      const names = blockedVariableParents.map((item) => item.sku || item.product_name || item.name || item.product_id).join(", ");
      setValidationError(`These selected items are variable parent products and cannot be added to a purchase order: ${names}. Select specific variation SKUs instead.`);
      return;
    }

    setLoading(true);
    setValidationError(null);
    setRequestError(null);
    try {
      if (selectedPoId === "new") {
        await purchaseOrdersApi.create({
          po_number: "",
          status: "draft",
          created_date: new Date().toISOString().slice(0, 19).replace("T", " "),
          created_by: "Analytics Stock Page",
          shipping_type: "sea",
          lead_time_days: 0,
          eta_date: null,
          supplier_currency: "AUD",
          currency_conversion_rate: 1.0,
          m3: 0,
          m3_rate: 0,
          shipping_cost_origin: 0,
          product_cost_origin: 0,
          total_cost_origin: 0,
          shipping_cost_aud: 0,
          product_cost_aud: 0,
          product_cost_adjustments_aud: 0,
          total_cost_aud: 0,
          lines: mergePurchaseOrderLines([], selectedItems)
        });
      } else {
        const poToUpdate: PurchaseOrder = await purchaseOrdersApi.get(parseInt(selectedPoId));
        const currentLines = poToUpdate.lines || [];
        const mergedLines = mergePurchaseOrderLines(currentLines, selectedItems);
        await purchaseOrdersApi.update(poToUpdate.id!, { lines: mergedLines });
      }
      onClose(true);
    } catch (err) {
      console.error(err);
      setRequestError(err instanceof Error ? err.message : "Failed to add to Purchase Order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Add to Purchase Order</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Adding {selectedItems.length} item(s) to a Purchase Order.
        </Typography>
        {validationError && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setValidationError(null)}>
            {validationError}
          </Alert>
        )}
        {requestError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRequestError(null)}>
            {requestError}
          </Alert>
        )}
        
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <TextField
            fullWidth
            select
            label="Select Purchase Order"
            value={selectedPoId}
            onChange={(e) => setSelectedPoId(e.target.value)}
            margin="normal"
          >
            <MenuItem value="new">-- Create New Draft PO --</MenuItem>
            {pos.map(po => (
              <MenuItem key={po.id} value={po.id!.toString()}>
                {po.po_number} ({po.status})
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
