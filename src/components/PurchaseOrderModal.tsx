import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, MenuItem, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Divider, Autocomplete, CircularProgress } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { PurchaseOrder, PurchaseOrderLine, purchaseOrdersApi } from "../api/purchaseOrdersApi";
import { Supplier, suppliersApi } from "../api/suppliersApi";
import ProductSearchAutocomplete from "./ProductSearchAutocomplete";
import { ProductSearchResult } from "../api/productsApi";

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
  supplier_id: undefined,
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    suppliersApi.getAll().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => {
    if (po) {
      setFormData(po);
    } else {
      setFormData(defaultPo);
    }
  }, [po]);

  const handleChange = (field: keyof PurchaseOrder, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate AUD fields based on conversion rate
      const rate = field === 'currency_conversion_rate' ? (parseFloat(value) || 1.0) : (parseFloat(prev.currency_conversion_rate as any) || 1.0);
      
      // Only product cost is affected by conversion rate
      if (field === 'product_cost_origin' || field === 'currency_conversion_rate') {
        const productCostOrigin = parseFloat(updated.product_cost_origin as any) || 0;
        updated.product_cost_aud = parseFloat((productCostOrigin * rate).toFixed(2));
      }

      // Auto-calculate line items if conversion rate changes
      if (field === 'currency_conversion_rate' && updated.lines) {
        updated.lines = updated.lines.map(line => ({
          ...line,
          unit_price_aud: parseFloat(((parseFloat(line.supplier_unit_price as any) || 0) * rate).toFixed(2)),
          total_aud: parseFloat(((parseFloat(line.supplier_total as any) || 0) * rate).toFixed(2))
        }));
      }

      // Recalculate totals
      const productCostOrigin = parseFloat(updated.product_cost_origin as any) || 0;
      const shippingCostOrigin = parseFloat(updated.shipping_cost_origin as any) || 0;
      updated.total_cost_origin = parseFloat((productCostOrigin + shippingCostOrigin).toFixed(2));

      const productCostAud = parseFloat(updated.product_cost_aud as any) || 0;
      const shippingCostAud = parseFloat(updated.shipping_cost_aud as any) || 0;
      const productCostAdjustmentsAud = parseFloat(updated.product_cost_adjustments_aud as any) || 0;
      updated.total_cost_aud = parseFloat((productCostAud + shippingCostAud + productCostAdjustmentsAud).toFixed(2));

      return updated;
    });
  };

  const handleLineChange = (index: number, field: keyof PurchaseOrderLine, value: any) => {
    setFormData(prev => {
      const newLines = [...(prev.lines || [])];
      const line = { ...newLines[index], [field]: value };
      const rate = parseFloat(prev.currency_conversion_rate as any) || 1.0;

      // Auto-calculate line totals and AUD prices
      if (field === 'qty' || field === 'supplier_unit_price') {
        const qty = field === 'qty' ? (parseInt(value) || 0) : (parseInt(line.qty as any) || 0);
        const unitPrice = field === 'supplier_unit_price' ? (parseFloat(value) || 0) : (parseFloat(line.supplier_unit_price as any) || 0);
        
        line.supplier_total = parseFloat((qty * unitPrice).toFixed(2));
        line.unit_price_aud = parseFloat((unitPrice * rate).toFixed(2));
        line.total_aud = parseFloat((line.supplier_total * rate).toFixed(2));
      }

      newLines[index] = line;
      return { ...prev, lines: newLines };
    });
  };

  const handleAddBlankLine = () => {
    const newLines = [...(formData.lines || []), { product_id: 0, sku: "", product_name: "", qty: 1 }];
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const handleAddProductFromSearch = (product: ProductSearchResult | null) => {
    if (!product) return;
    
    let wsviGroupId = undefined;

    if (product.wsvi_group_id) {
      wsviGroupId = product.wsvi_group_id;
    }

    const newLines = [...(formData.lines || []), { 
      product_id: product.id, 
      wsvi_group_id: wsviGroupId,
      sku: product.sku || "", 
      product_name: product.name,
      qty: 1,
      supplier_unit_price: 0,
      unit_price_aud: 0,
      supplier_total: 0,
      total_aud: 0
    }];
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
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="xl" fullWidth>
      <DialogTitle>{po ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="PO Number"
                value={formData.po_number || ""}
                onChange={(e) => handleChange("po_number", e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Supplier"
                value={formData.supplier_id || ""}
                onChange={(e) => handleChange("supplier_id", parseInt(e.target.value) || undefined)}
                margin="normal"
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {suppliers.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
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

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              label="Supplier Currency"
              value={formData.supplier_currency || "AUD"}
              onChange={(e) => handleChange("supplier_currency", e.target.value)}
              margin="normal"
            >
              <MenuItem value="AUD">AUD</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
              <MenuItem value="GBP">GBP</MenuItem>
              <MenuItem value="CNY">CNY</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Conversion Rate"
              type="number"
              value={formData.currency_conversion_rate || 1.0}
              onChange={(e) => handleChange("currency_conversion_rate", parseFloat(e.target.value) || 1.0)}
              margin="normal"
              inputProps={{ step: "0.0001" }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="M3"
              type="number"
              value={formData.m3 || 0}
              onChange={(e) => handleChange("m3", parseFloat(e.target.value) || 0)}
              margin="normal"
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="M3 Rate"
              type="number"
              value={formData.m3_rate || 0}
              onChange={(e) => handleChange("m3_rate", parseFloat(e.target.value) || 0)}
              margin="normal"
              inputProps={{ step: "0.01" }}
            />
          </Grid>

            <Grid item xs={12}>
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" color="primary">Origin Costs (Supplier Currency)</Typography>
                <Divider />
              </Box>
            </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="Product Cost"
              type="number"
              value={formData.product_cost_origin || 0}
              onChange={(e) => handleChange("product_cost_origin", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="Shipping Cost"
              type="number"
              value={formData.shipping_cost_origin || 0}
              onChange={(e) => handleChange("shipping_cost_origin", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="Total Cost"
              type="number"
              value={formData.total_cost_origin || 0}
              onChange={(e) => handleChange("total_cost_origin", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>

            <Grid item xs={12}>
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" color="primary">Landed Costs (AUD)</Typography>
                <Divider />
              </Box>
            </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Product Cost"
              type="number"
              value={formData.product_cost_aud || 0}
              onChange={(e) => handleChange("product_cost_aud", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Adjustments"
              type="number"
              value={formData.product_cost_adjustments_aud || 0}
              onChange={(e) => handleChange("product_cost_adjustments_aud", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Shipping Cost"
              type="number"
              value={formData.shipping_cost_aud || 0}
              onChange={(e) => handleChange("shipping_cost_aud", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Total Cost"
              type="number"
              value={formData.total_cost_aud || 0}
              onChange={(e) => handleChange("total_cost_aud", parseFloat(e.target.value) || 0)}
              inputProps={{ step: "0.01" }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mt: 3, mb: 1 }}>
              <Typography variant="h6" color="primary">Line Items</Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <ProductSearchAutocomplete
                value={null}
                onChange={handleAddProductFromSearch}
                label="Search to Add Product..."
                size="medium"
              />
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ width: '100%', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1000 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width="35%">Product Name</TableCell>
                    <TableCell width="25%">SKU</TableCell>
                    <TableCell width="8%">Qty</TableCell>
                    <TableCell width="10%">Unit Price (Origin)</TableCell>
                    <TableCell width="10%">Unit Price (AUD)</TableCell>
                    <TableCell width="10%">Total (Origin)</TableCell>
                    <TableCell width="10%">Total (AUD)</TableCell>
                    <TableCell width="2%" align="right">
                      <IconButton size="small" onClick={handleAddBlankLine} color="primary" title="Add Blank Line">
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
                          fullWidth
                          value={line.product_name || ""}
                          onChange={(e) => handleLineChange(index, "product_name", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={line.sku || ""}
                          onChange={(e) => handleLineChange(index, "sku", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.qty || 0}
                          onChange={(e) => handleLineChange(index, "qty", parseInt(e.target.value) || 0)}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.supplier_unit_price || 0}
                          onChange={(e) => handleLineChange(index, "supplier_unit_price", parseFloat(e.target.value) || 0)}
                          inputProps={{ step: "0.01" }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.unit_price_aud || 0}
                          onChange={(e) => handleLineChange(index, "unit_price_aud", parseFloat(e.target.value) || 0)}
                          inputProps={{ step: "0.01" }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.supplier_total || 0}
                          onChange={(e) => handleLineChange(index, "supplier_total", parseFloat(e.target.value) || 0)}
                          inputProps={{ step: "0.01" }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={line.total_aud || 0}
                          onChange={(e) => handleLineChange(index, "total_aud", parseFloat(e.target.value) || 0)}
                          inputProps={{ step: "0.01" }}
                          sx={{ width: 100 }}
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
