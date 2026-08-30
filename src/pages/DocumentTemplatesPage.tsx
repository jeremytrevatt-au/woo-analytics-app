import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  createDocumentTemplate,
  DocumentTemplate,
  listDocumentTemplates,
  updateDocumentTemplate,
} from "../api/documentTemplatesApi";

const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "new_customer", label: "New Customer" },
  { value: "product_sku", label: "Product SKU" },
  { value: "product_category", label: "Product Category" },
  { value: "order_tag", label: "Order Tag" },
];

function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [matchValue, setMatchValue] = useState("");
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState("");

  const loadTemplates = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await listDocumentTemplates({ triggerType: triggerFilter });
      setTemplates(response);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to load document templates." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [triggerFilter]);

  const resetForm = () => {
    setName("");
    setTriggerType("manual");
    setMatchValue("");
    setGoogleDriveUrl("");
    setEnabled(true);
    setNotes("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !googleDriveUrl.trim()) {
      setMessage({ type: "error", text: "Name and Google Drive URL are required." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await createDocumentTemplate({
        name,
        trigger_type: triggerType,
        match_value: matchValue,
        google_drive_url: googleDriveUrl,
        enabled,
        notes,
      });
      resetForm();
      setMessage({ type: "success", text: "Document template saved." });
      await loadTemplates();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save document template." });
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledChange = async (template: DocumentTemplate, nextEnabled: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateDocumentTemplate(template.id, { enabled: nextEnabled });
      setTemplates(prev => prev.map(item => item.id === updated.id ? updated : item));
      setMessage({ type: "success", text: `${updated.name} ${nextEnabled ? "enabled" : "disabled"}.` });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update document template." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Document Templates
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure Google Drive documents that can later be surfaced on the Packing Team page for manual or rule-based printing.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add Template
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} sx={{ minWidth: 260 }} />
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel>Trigger Type</InputLabel>
              <Select label="Trigger Type" value={triggerType} onChange={(event) => setTriggerType(event.target.value)}>
                {TRIGGER_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Match Value"
              value={matchValue}
              onChange={(event) => setMatchValue(event.target.value)}
              helperText="Example: SKU, category, or tag depending on trigger type"
              sx={{ minWidth: 280 }}
            />
          </Stack>
          <TextField
            label="Google Drive URL"
            value={googleDriveUrl}
            onChange={(event) => setGoogleDriveUrl(event.target.value)}
            fullWidth
          />
          <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} />
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={<Checkbox checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />}
              label="Enabled"
            />
            <Button variant="contained" onClick={handleCreate} disabled={saving}>
              Save Template
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Configured Templates</Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Trigger</InputLabel>
            <Select label="Trigger" value={triggerFilter} onChange={(event) => setTriggerFilter(event.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {TRIGGER_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Trigger</TableCell>
              <TableCell>Match Value</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map(template => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>{template.trigger_type}</TableCell>
                <TableCell>{template.match_value}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={Boolean(Number(template.enabled))}
                    disabled={saving}
                    onChange={(event) => handleEnabledChange(template, event.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <Button href={template.google_drive_url} target="_blank" rel="noreferrer" size="small">
                    Open Source
                  </Button>
                </TableCell>
                <TableCell>{template.updated_at}</TableCell>
              </TableRow>
            ))}
            {!loading && templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No document templates configured.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    Loading document templates...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default DocumentTemplatesPage;
