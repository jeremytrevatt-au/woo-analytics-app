import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, MenuItem, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { PurchaseOrder, PurchaseOrderLine, purchaseOrdersApi } from "../api/purchaseOrdersApi";

type Props = {
  open: boolean;
  onClose: (saved: boolean) => void;
  po: PurchaseOrder | null;
};

const defaultPo: Partial<PurchaseOrder> = {
  po_number: "",
  status: "draft",
  created_date: new Date().toISOString().slice(0, 19).replace("T", " "),
  created_by: "",
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
};

export default function PurchaseOrderModal({ open, onClose, po }: Props) {
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>(defaultPo);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (po) {
      setFormData(po);
    } else {
      setFormData(defaultPo);
    }
  }, [po]);

  const handleChange = (field: keyof PurchaseOrder, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index: number, field: keyof PurchaseOrderLine, value: any) => {
    const newLines = [...(formData.lines || [])];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const handleAddLine = () => {
    const newLines = [...(formData.lines || []), { product_id: 0, sku: "", product_name: "", qty: 1 }];
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const handleRemoveLine = (index: number) => {
    const newLines = [...(formData.lines || [])];
    newLines.splice(index, 1);
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (po?.id) {
        await purchaseOrdersApi.update(po.id, formData);
      } else {
        await purchaseOrdersApi.create(formData);
      }
      onClose(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save purchase order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth>
      <DialogTitle>{po ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="PO Number"
              value={formData.po_number || ""}
              onChange={(e) => handleChange("po_number", e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Status"
              value={formData.status || "draft"}
              onChange={(e) => handleChange("status", e.target.value)}
              margin="normal"
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="ordered">Ordered</MenuItem>
              <MenuItem value="shipped">Shipped</MenuItem>
              <MenuItem value="received">Received</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Created Date"
              type="datetime-local"
              value={formData.created_date ? formData.created_date.replace(" ", "T") : ""}
              onChange={(e) => handleChange("created_date", e.target.value.replace("T", " "))}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="ETA Date"
              type="date"
              value={formData.eta_date ? formData.eta_date.split(" ")[0] : ""}
              onChange={(e) => handleChange("eta_date", e.target.value)}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Shipping Type"
              value={formData.shipping_type || "sea"}
              onChange={(e) => handleChange("shipping_type", e.target.value)}
              margin="normal"
            >
              <MenuItem value="sea">Sea</MenuItem>
              <MenuItem value="air">Air</MenuItem>
              <MenuItem value="land">Land</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Lead Time (Days)"
              type="number"
              value={formData.lead_time_days || 0}
              onChange={(e) => handleChange("lead_time_days", parseInt(e.target.value) || 0)}
              margin="normal"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Line Items</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product ID</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={handleAddLine} color="primary">
                        <AddIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(formData.lines || []).map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.product_id || ""}
                          onChange={(e) => handleLineChange(index, "product_id", parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={line.sku || ""}
                          onChange={(e) => handleLineChange(index, "sku", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={line.product_name || ""}
                          onChange={(e) => handleLineChange(index, "product_name", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.qty || 0}
                          onChange={(e) => handleLineChange(index, "qty", parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleRemoveLine(index)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!formData.lines || formData.lines.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No lines added.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
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
