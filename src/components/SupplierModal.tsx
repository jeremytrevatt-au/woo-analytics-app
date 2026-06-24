import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Grid, CircularProgress } from "@mui/material";
import { Supplier, suppliersApi } from "../api/suppliersApi";

interface Props {
  open: boolean;
  onClose: (saved: boolean) => void;
  supplier: Supplier | null;
}

const defaultSupplier: Partial<Supplier> = {
  name: "",
  contact_name: "",
  email: "",
  default_currency: "AUD",
  default_lead_time_days: 0
};

export default function SupplierModal({ open, onClose, supplier }: Props) {
  const [formData, setFormData] = useState<Partial<Supplier>>(defaultSupplier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormData(supplier || defaultSupplier);
      setError(null);
    }
  }, [open, supplier]);

  const handleChange = (field: keyof Supplier, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      setError("Supplier name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (formData.id) {
        await suppliersApi.update(formData.id, formData);
      } else {
        await suppliersApi.create(formData);
      }
      onClose(true);
    } catch (err: any) {
      setError(err.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{formData.id ? "Edit Supplier" : "New Supplier"}</DialogTitle>
      <DialogContent dividers>
        {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Supplier Name"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              margin="normal"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Contact Name"
              value={formData.contact_name || ""}
              onChange={(e) => handleChange("contact_name", e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Default Currency"
              value={formData.default_currency || "AUD"}
              onChange={(e) => handleChange("default_currency", e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Default Lead Time (Days)"
              type="number"
              value={formData.default_lead_time_days || 0}
              onChange={(e) => handleChange("default_lead_time_days", parseInt(e.target.value) || 0)}
              margin="normal"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={24} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
