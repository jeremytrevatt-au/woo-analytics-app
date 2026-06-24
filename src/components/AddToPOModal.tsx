import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, CircularProgress, Typography } from "@mui/material";
import { purchaseOrdersApi, PurchaseOrder } from "../api/purchaseOrdersApi";

type Props = {
  open: boolean;
  onClose: (saved: boolean) => void;
  selectedItems: any[]; // Items from Stock or Orders
};

export default function AddToPOModal({ open, onClose, selectedItems }: Props) {
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("new");

  useEffect(() => {
    if (open) {
      setLoading(true);
      purchaseOrdersApi.list("draft")
        .then(data => setPos(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleSave = async () => {
    setLoading(true);
    try {
      let poToUpdate: PurchaseOrder;
      
      if (selectedPoId === "new") {
        // Create new PO
        const newPo = await purchaseOrdersApi.create({
          po_number: \PO-\-\\,
          status: "draft",
          created_date: new Date().toISOString().slice(0, 19).replace("T", " "),
          created_by: "System",
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
          lines: []
        });
        poToUpdate = newPo;
      } else {
        poToUpdate = await purchaseOrdersApi.get(parseInt(selectedPoId));
      }

      // Add lines
      const currentLines = poToUpdate.lines || [];
      const newLines = selectedItems.map(item => {
        // Handle both Stock (product_id, sku, product_name) and Orders (product_id, sku, product_name, qty)
        const qty = item.qty || 1; // Default to 1 if from stock
        return {
          product_id: item.product_id,
          sku: item.sku || "",
          product_name: item.product_name || item.name || "",
          qty: qty
        };
      });

      // Merge lines (if product already exists, add qty)
      newLines.forEach(nl => {
        const existing = currentLines.find(cl => cl.product_id === nl.product_id);
        if (existing) {
          existing.qty += nl.qty;
        } else {
          currentLines.push(nl);
        }
      });

      await purchaseOrdersApi.update(poToUpdate.id!, { lines: currentLines });
      onClose(true);
    } catch (err) {
      console.error(err);
      alert("Failed to add to Purchase Order");
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
