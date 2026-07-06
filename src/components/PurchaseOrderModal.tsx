import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, MenuItem, Typography, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Divider, Autocomplete, CircularProgress } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
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
  pallet_weight: 0,
  number_of_pallets: 0,
  supplier_order_number: "",
  product_cost_adjustments_origin: 0,
  product_cost_origin: 0,
  shipping_cost_origin: 0,
  total_cost_origin: 0,
  shipping_cost_origin_aud: 0,
  shipping_cost_aud: 0,
  product_cost_aud: 0,
  product_cost_adjustments_aud: 0,
  total_cost_aud: 0,
  lines: []
};

const toNumber = (value: unknown, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: number) => parseFloat(value.toFixed(2));

const normaliseLines = (lines: PurchaseOrderLine[] = [], rate: number): PurchaseOrderLine[] =>
  lines.map((line) => {
    const qty = Math.trunc(toNumber(line.qty));
    const supplierUnitPrice = toNumber(line.supplier_unit_price);
    const supplierTotal = toNumber(line.supplier_total);
    return {
      ...line,
      qty,
      supplier_unit_price: supplierUnitPrice,
      supplier_total: supplierTotal,
      unit_price_aud: roundMoney(supplierUnitPrice * rate),
      total_aud: roundMoney(supplierTotal * rate),
    };
  });

const recalculatePurchaseOrder = (po: Partial<PurchaseOrder>): Partial<PurchaseOrder> => {
  const rate = toNumber(po.currency_conversion_rate, 1);
  const lines = normaliseLines(po.lines || [], rate);
  const linesTotalOrigin = lines.reduce((sum, line) => sum + toNumber(line.supplier_total), 0);
  const adjustmentsOrigin = toNumber(po.product_cost_adjustments_origin);
  const productCostOrigin = roundMoney(linesTotalOrigin + adjustmentsOrigin);
  const shippingCostOrigin = toNumber(po.shipping_cost_origin);
  const shippingCostOriginAud = roundMoney(shippingCostOrigin * rate);
  const productCostAud = roundMoney(productCostOrigin * rate);
  const destinationShippingAud = toNumber(po.shipping_cost_aud);
  const adjustmentsAud = toNumber(po.product_cost_adjustments_aud);

  return {
    ...po,
    lines,
    currency_conversion_rate: rate,
    product_cost_adjustments_origin: adjustmentsOrigin,
    product_cost_origin: productCostOrigin,
    shipping_cost_origin: shippingCostOrigin,
    total_cost_origin: roundMoney(productCostOrigin + shippingCostOrigin),
    shipping_cost_origin_aud: shippingCostOriginAud,
    shipping_cost_aud: destinationShippingAud,
    product_cost_aud: productCostAud,
    product_cost_adjustments_aud: adjustmentsAud,
    total_cost_aud: roundMoney(productCostAud + shippingCostOriginAud + destinationShippingAud + adjustmentsAud),
  };
};

const normalisePurchaseOrderPayload = (po: Partial<PurchaseOrder>): Partial<PurchaseOrder> => {
  const recalculated = recalculatePurchaseOrder(po);
  return {
    ...recalculated,
    lead_time_days: Math.trunc(toNumber(recalculated.lead_time_days)),
    m3: toNumber(recalculated.m3),
    m3_rate: toNumber(recalculated.m3_rate),
    pallet_weight: toNumber(recalculated.pallet_weight),
    number_of_pallets: Math.trunc(toNumber(recalculated.number_of_pallets)),
  };
};

export default function PurchaseOrderModal({ open, onClose, po }: Props) {
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>(defaultPo);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  useEffect(() => {
    suppliersApi.getAll().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => {
    if (po) {
      setFormData(recalculatePurchaseOrder({
        ...po,
        shipping_type: po.shipping_type || "sea"
      }));
    } else {
      setFormData(defaultPo);
    }
  }, [po]);

  const handleChange = (field: keyof PurchaseOrder, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      const recalculated = recalculatePurchaseOrder(updated);
      return { ...recalculated, [field]: value };
    });
  };

  const handleLineChange = (index: number, field: keyof PurchaseOrderLine, value: any) => {
    setFormData(prev => {
      const newLines = [...(prev.lines || [])];
      const line = { ...newLines[index], [field]: value };
      const rate = toNumber(prev.currency_conversion_rate, 1);

      if (field === 'qty' || field === 'supplier_unit_price') {
        const qty = field === 'qty' ? Math.trunc(toNumber(value)) : Math.trunc(toNumber(line.qty));
        const unitPrice = field === 'supplier_unit_price' ? toNumber(value) : toNumber(line.supplier_unit_price);
        
        line.supplier_total = roundMoney(qty * unitPrice);
        line.unit_price_aud = roundMoney(unitPrice * rate);
        line.total_aud = roundMoney(toNumber(line.supplier_total) * rate);
      } else if (field === 'supplier_total') {
        const total = toNumber(value);
        const qty = Math.trunc(toNumber(line.qty)) || 1;
        line.supplier_unit_price = roundMoney(total / qty);
        line.unit_price_aud = roundMoney(toNumber(line.supplier_unit_price) * rate);
        line.total_aud = roundMoney(total * rate);
      } else if (field === 'unit_price_aud') {
        const unitPriceAud = toNumber(value);
        const qty = Math.trunc(toNumber(line.qty));
        const supplierUnitPrice = rate ? roundMoney(unitPriceAud / rate) : 0;
        line.supplier_unit_price = supplierUnitPrice;
        line.supplier_total = roundMoney(qty * supplierUnitPrice);
        line.total_aud = roundMoney(qty * unitPriceAud);
      } else if (field === 'total_aud') {
        const totalAud = toNumber(value);
        const qty = Math.trunc(toNumber(line.qty)) || 1;
        const supplierTotal = rate ? roundMoney(totalAud / rate) : 0;
        line.supplier_total = supplierTotal;
        line.supplier_unit_price = roundMoney(supplierTotal / qty);
        line.unit_price_aud = roundMoney(toNumber(line.supplier_unit_price) * rate);
      }

      newLines[index] = line;
      const recalculated = recalculatePurchaseOrder({ ...prev, lines: newLines });
      const recalculatedLines = [...(recalculated.lines || [])];
      recalculatedLines[index] = { ...recalculatedLines[index], [field]: value };
      return { ...recalculated, lines: recalculatedLines };
    });
  };

  const handleAddBlankLine = () => {
    setFormData(prev => recalculatePurchaseOrder({
      ...prev,
      lines: [...(prev.lines || []), { product_id: 0, supplier_sku: "", sku: "", product_name: "", qty: 1, supplier_unit_price: 0, unit_price_aud: 0, supplier_total: 0, total_aud: 0 }]
    }));
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
      supplier_sku: "",
      sku: product.sku || "", 
      product_name: product.name,
      qty: 1,
      supplier_unit_price: 0,
      unit_price_aud: 0,
      supplier_total: 0,
      total_aud: 0
    }];
    setFormData(prev => recalculatePurchaseOrder({ ...prev, lines: newLines }));
  };

  const handleRemoveLine = (index: number) => {
    const newLines = [...(formData.lines || [])];
    newLines.splice(index, 1);
    setFormData(prev => recalculatePurchaseOrder({ ...prev, lines: newLines }));
  };

  const handleMoveLineUp = (index: number) => {
    if (index === 0) return;
    const newLines = [...(formData.lines || [])];
    const temp = newLines[index - 1];
    newLines[index - 1] = newLines[index];
    newLines[index] = temp;
    setFormData(prev => recalculatePurchaseOrder({ ...prev, lines: newLines }));
  };

  const handleMoveLineDown = (index: number) => {
    const lines = formData.lines || [];
    if (index === lines.length - 1) return;
    const newLines = [...lines];
    const temp = newLines[index + 1];
    newLines[index + 1] = newLines[index];
    newLines[index] = temp;
    setFormData(prev => recalculatePurchaseOrder({ ...prev, lines: newLines }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (po?.id) {
        await purchaseOrdersApi.update(po.id, normalisePurchaseOrderPayload(formData));
      } else {
        await purchaseOrdersApi.create(normalisePurchaseOrderPayload(formData));
      }
      onClose(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save purchase order");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === index) return;

    const newLines = Array.from(formData.lines || []);
    const [reorderedItem] = newLines.splice(draggedRowIndex, 1);
    newLines.splice(index, 0, reorderedItem);

    setFormData(prev => ({ ...prev, lines: newLines }));
    setDraggedRowIndex(null);
    setActiveRowIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedRowIndex(null);
  };

  return (
      <Dialog open={open} onClose={() => onClose(false)} maxWidth={false} PaperProps={{ sx: { width: '98%', maxWidth: 'none' } }}>
        <DialogTitle>{po ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="PO Number"
                  value={formData.po_number || ""}
                  onChange={(e) => handleChange("po_number", e.target.value)}
                  margin="normal"
                  InputProps={{ readOnly: true }}
                  helperText={po ? "" : "Generated when saved"}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Supplier Order Number"
                  value={formData.supplier_order_number || ""}
                  onChange={(e) => handleChange("supplier_order_number", e.target.value)}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  select
                  label="Supplier"
                  value={formData.supplier_id || ""}
                onChange={(e) => handleChange("supplier_id", e.target.value ? parseInt(e.target.value) : undefined)}
                  margin="normal"
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {suppliers.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
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
                onChange={(e) => handleChange("lead_time_days", e.target.value)}
                margin="normal"
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Google Drive Link"
                  value={formData.drive_link || ""}
                  onChange={(e) => handleChange("drive_link", e.target.value)}
                  margin="normal"
                  placeholder="https://docs.google.com/..."
                />
                {formData.drive_link && (
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    href={formData.drive_link} 
                    target="_blank"
                    sx={{ mt: 1, whiteSpace: 'nowrap' }}
                  >
                    Open Document
                  </Button>
                )}
              </Box>
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
                value={formData.currency_conversion_rate ?? ""}
                onChange={(e) => handleChange("currency_conversion_rate", e.target.value)}
                margin="normal"
                inputProps={{ step: "0.0001" }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="M3"
                type="number"
                value={formData.m3 ?? ""}
                onChange={(e) => handleChange("m3", e.target.value)}
                margin="normal"
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="M3 Rate"
                  type="number"
                  value={formData.m3_rate ?? ""}
                  onChange={(e) => handleChange("m3_rate", e.target.value)}
                  margin="normal"
                  inputProps={{ step: "0.01" }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Pallet Weight"
                  type="number"
                  value={formData.pallet_weight ?? ""}
                  onChange={(e) => handleChange("pallet_weight", e.target.value)}
                  margin="normal"
                  inputProps={{ step: "0.01" }}
                />
              </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Number of Pallets / Parcels"
                type="number"
                value={formData.number_of_pallets ?? ""}
                onChange={(e) => handleChange("number_of_pallets", e.target.value)}
                margin="normal"
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" color="primary">Origin Costs (Supplier Currency)</Typography>
                <Divider />
              </Box>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Product Adjustments"
                type="number"
                value={formData.product_cost_adjustments_origin ?? ""}
                onChange={(e) => handleChange("product_cost_adjustments_origin", e.target.value)}
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Origin Shipping Cost"
                type="number"
                value={formData.shipping_cost_origin ?? ""}
                onChange={(e) => handleChange("shipping_cost_origin", e.target.value)}
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Total Product Cost"
                type="number"
                value={formData.product_cost_origin ?? ""}
                onChange={(e) => handleChange("product_cost_origin", e.target.value)}
                inputProps={{ step: "0.01" }}
                disabled // Auto-calculated from lines + adjustments
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Total Origin Cost"
                type="number"
                value={formData.total_cost_origin ?? ""}
                inputProps={{ step: "0.01" }}
                disabled
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" color="primary">Landed Costs (AUD)</Typography>
                <Divider />
              </Box>
            </Grid>
            <Grid item xs={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Product Cost"
                type="number"
                value={formData.product_cost_aud ?? ""}
                onChange={(e) => handleChange("product_cost_aud", e.target.value)}
                inputProps={{ step: "0.01" }}
                disabled
              />
            </Grid>
            <Grid item xs={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Origin Shipping (AUD)"
                type="number"
                value={formData.shipping_cost_origin_aud ?? ""}
                inputProps={{ step: "0.01" }}
                disabled
              />
            </Grid>
            <Grid item xs={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Destination Shipping Cost"
                type="number"
                value={formData.shipping_cost_aud ?? ""}
                onChange={(e) => handleChange("shipping_cost_aud", e.target.value)}
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Adjustments"
                type="number"
                value={formData.product_cost_adjustments_aud ?? ""}
                onChange={(e) => handleChange("product_cost_adjustments_aud", e.target.value)}
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={2.4}>
              <TextField
                fullWidth
                size="small"
                label="Grand Total Cost (AUD)"
                type="number"
                value={formData.total_cost_aud ?? ""}
                onChange={(e) => handleChange("total_cost_aud", e.target.value)}
                inputProps={{ step: "0.01" }}
                disabled // Auto-calculated
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: "#000000",
                    fontWeight: "bold"
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} sx={{ width: '100%' }}>
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
  
                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                  <TableContainer component={Paper} variant="outlined" sx={{ width: '100%' }}>
                    <Table size="small" sx={{ width: '100%', minWidth: 1800 }}>
                      <TableHead>
                      <TableRow>
                        <TableCell width="30%">Product Name</TableCell>
                        <TableCell width="15%">SKU</TableCell>
                        <TableCell width="15%">ORIGIN SKU</TableCell>
                        <TableCell width="5%">Qty</TableCell>
                        <TableCell width="7%">Unit Price (Origin)</TableCell>
                        <TableCell width="7%">Unit Price (AUD)</TableCell>
                        <TableCell width="7%">Total (Origin)</TableCell>
                        <TableCell width="7%">Total (AUD)</TableCell>
                        <TableCell width="7%" align="right">
                          <IconButton size="small" onClick={handleAddBlankLine} color="primary" title="Add Blank Line">
                            <AddIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      </TableHead>
                  <TableBody>
                    {(formData.lines || []).map((line, index) => (
                        <TableRow 
                          key={index}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setActiveRowIndex(index)}
                          sx={{ 
                            bgcolor: activeRowIndex === index ? 'rgba(76, 175, 80, 0.1)' : (draggedRowIndex === index ? 'action.hover' : 'inherit'),
                            cursor: 'grab',
                            '&:active': { cursor: 'grabbing' }
                          }}
                        >
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={6}
                            value={line.product_name || ""}
                            onChange={(e) => handleLineChange(index, "product_name", e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={6}
                            value={line.sku || ""}
                            onChange={(e) => handleLineChange(index, "sku", e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={line.supplier_sku || ""}
                            onChange={(e) => handleLineChange(index, "supplier_sku", e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.qty ?? ""}
                            onChange={(e) => handleLineChange(index, "qty", e.target.value)}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.supplier_unit_price ?? ""}
                            onChange={(e) => handleLineChange(index, "supplier_unit_price", e.target.value)}
                            inputProps={{ step: "0.01" }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.unit_price_aud ?? ""}
                            onChange={(e) => handleLineChange(index, "unit_price_aud", e.target.value)}
                            inputProps={{ step: "0.01" }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.supplier_total ?? ""}
                            onChange={(e) => handleLineChange(index, "supplier_total", e.target.value)}
                            inputProps={{ step: "0.01" }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.total_aud ?? ""}
                            onChange={(e) => handleLineChange(index, "total_aud", e.target.value)}
                            inputProps={{ step: "0.01" }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton size="small" onClick={() => handleMoveLineUp(index)} disabled={index === 0}>
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleMoveLineDown(index)} disabled={index === (formData.lines || []).length - 1}>
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleRemoveLine(index)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                    </TableRow>
                  ))}
                  {(!formData.lines || formData.lines.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No lines added.</TableCell>
                    </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              </Box>
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
