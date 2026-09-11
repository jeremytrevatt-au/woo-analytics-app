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
  CircularProgress,
  MenuItem
} from "@mui/material";
import { updateStockProductFields } from "../api/analyticsApi";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedProducts: any[];
  onSuccess: () => void;
};

type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: Array<{ value: string; label: string }>;
  toPayload?: (value: string) => unknown;
};

const FIELD_CONFIGS: FieldConfig[] = [
  { key: "_nya_default_lead_time", label: "Default Lead Time (Days)", type: "number" },
  { key: "_nya_stock_reordered_date", label: "Reordered Date", type: "date" },
  { key: "_nya_stock_lead_time", label: "Active Lead Time (Days)", type: "number" },
  { key: "_nya_stock_reorder_qty", label: "Reorder Qty", type: "number" },
  { key: "_nya_stock_eta", label: "ETA Date", type: "date" },
  { key: "weight", label: "Weight", type: "number" },
  { key: "length", label: "Length", type: "number" },
  { key: "width", label: "Width", type: "number" },
  { key: "height", label: "Height", type: "number" },
  { key: "shipping_class", label: "Shipping Class", type: "text" },
  { key: "regular_price", label: "Regular Price", type: "number" },
  { key: "sale_price", label: "Sale Price", type: "number" },
  {
    key: "manage_stock",
    label: "Manage Stock?",
    type: "select",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
    toPayload: (value) => value === "true",
  },
  {
    key: "enabled",
    label: "Enabled?",
    type: "select",
    options: [
      { value: "true", label: "Enabled (Publish)" },
      { value: "false", label: "Disabled (Draft)" },
    ],
    toPayload: (value) => value === "true",
  },
  {
    key: "backorders",
    label: "Allow Back-orders?",
    type: "select",
    options: [
      { value: "no", label: "Do not allow" },
      { value: "notify", label: "Allow, but notify customer" },
      { value: "yes", label: "Allow" },
    ],
  },
  { key: "ny_shippit_ppm", label: "NY Stacking / Nesting Multiplier", type: "number" },
  { key: "ny_packaging_overhead", label: "NY Packaging Overhead", type: "number" },
  {
    key: "ny_psp",
    label: "NY Standalone Parcel (PSP)",
    type: "select",
    options: [
      { value: "", label: "Not configured / inherit" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

export default function BulkUpdateModal({ open, onClose, selectedProducts, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const editableProducts = selectedProducts.filter((product) => product.product_type !== "wsvi_group");
  const excludedCount = selectedProducts.length - editableProducts.length;

  const toggleField = (fieldKey: string, checked: boolean) => {
    setSelectedFields((previous) => ({ ...previous, [fieldKey]: checked }));
  };

  const updateFieldValue = (fieldKey: string, value: string) => {
    setFieldValues((previous) => ({ ...previous, [fieldKey]: value }));
  };

  const handleSubmit = async () => {
    if (editableProducts.length === 0) {
      setError("No editable products selected. WSVI grouped rows cannot be edited directly.");
      return;
    }

    const fields: Record<string, unknown> = {};
    FIELD_CONFIGS.forEach((config) => {
      if (!selectedFields[config.key]) return;
      const value = fieldValues[config.key] ?? "";
      fields[config.key] = config.toPayload ? config.toPayload(value) : value;
    });

    if (Object.keys(fields).length === 0) {
      setError("No fields selected for update.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const productIds = editableProducts.map(p => Number(p.product_id));
      const res = await updateStockProductFields(productIds, fields);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        const details = res.errors?.map((item) => `${item.product_id}: ${item.message}`).join("; ");
        setError(details || res.message || "Failed to update products.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during bulk update.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk Update Product Fields</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          You are about to update {editableProducts.length} editable product(s).
          Check the fields you want to apply to all selected products.
        </Typography>
        {excludedCount > 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {excludedCount} WSVI grouped row(s) are excluded because grouped rows cannot be edited directly.
          </Alert>
        ) : null}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          {FIELD_CONFIGS.map((config) => (
            <Stack key={config.key} direction="row" alignItems="center" spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(selectedFields[config.key])}
                    onChange={(event) => toggleField(config.key, event.target.checked)}
                  />
                }
                label={config.label}
                sx={{ width: 260, flexShrink: 0 }}
              />
              <TextField
                size="small"
                type={config.type === "select" ? undefined : config.type}
                select={config.type === "select"}
                disabled={!selectedFields[config.key]}
                value={fieldValues[config.key] ?? ""}
                onChange={(event) => updateFieldValue(config.key, event.target.value)}
                InputLabelProps={config.type === "date" ? { shrink: true } : undefined}
                fullWidth
              >
                {config.options?.map((option) => (
                  <MenuItem key={option.value || "blank"} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || editableProducts.length === 0}>
          {loading ? <CircularProgress size={24} /> : "Apply Updates"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}