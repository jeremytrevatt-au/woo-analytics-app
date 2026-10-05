import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { DocumentMacroMapping } from "../api/documentTemplatesApi";
import DocumentMacroMappingsEditor, {
  DEFAULT_DOCUMENT_MACRO_MAPPING,
  DEFAULT_PURCHASE_ORDER_MACRO_MAPPINGS,
  documentMacroSourceLabel,
  documentMacroSourcesForTrigger,
} from "../components/DocumentMacroMappingsEditor";

const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "new_customer", label: "New Customer" },
  { value: "product_sku", label: "Product SKU" },
  { value: "product_category", label: "Product Category" },
  { value: "order_tag", label: "Order Tag" },
  { value: "purchase_order", label: "Purchase Order" },
];

const PURCHASE_ORDER_MACRO_HELP = "Use the po_ tokens from the Google Doc. Put {po_supplier_sku}, {po_product_description}, {po_supplier_unit_price}, {po_qty}, and {po_line_total} in one table row. Blank Supplier SKU and Supplier price values stay in that row.";

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
  const [macroMappings, setMacroMappings] = useState<DocumentMacroMapping[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [editingMappings, setEditingMappings] = useState<DocumentMacroMapping[]>([]);

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
    setMacroMappings([]);
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
        macro_mappings: macroMappings,
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

  const handleSaveMappings = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateDocumentTemplate(editingTemplate.id, {
        macro_mappings: editingMappings,
      });
      setTemplates(previous => previous.map(template => (
        template.id === updated.id ? updated : template
      )));
      setEditingTemplate(null);
      setEditingMappings([]);
      setMessage({ type: "success", text: `${updated.name} macro mappings saved.` });
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save macro mappings.",
      });
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
        Configure Google Drive documents for packing prints and purchase order PDFs. A Purchase Order template uses one repeating product-line row.
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
              <Select
                label="Trigger Type"
                value={triggerType}
                onChange={(event) => {
                  const nextTriggerType = event.target.value;
                  setTriggerType(nextTriggerType);
                  if (nextTriggerType === "new_customer" && macroMappings.length === 0) {
                    setMacroMappings([{ ...DEFAULT_DOCUMENT_MACRO_MAPPING }]);
                  }
                  if (nextTriggerType === "purchase_order") {
                    setMacroMappings(DEFAULT_PURCHASE_ORDER_MACRO_MAPPINGS.map((mapping) => ({ ...mapping })));
                  }
                }}
              >
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
          <DocumentMacroMappingsEditor
            value={macroMappings}
            onChange={setMacroMappings}
            sources={documentMacroSourcesForTrigger(triggerType)}
            helperText={triggerType === "purchase_order" ? PURCHASE_ORDER_MACRO_HELP : undefined}
            disabled={saving}
          />
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
              <TableCell>Macros</TableCell>
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
                  <Stack spacing={0.5} alignItems="flex-start">
                    {(template.macro_mappings || []).map(mapping => (
                      <Typography key={mapping.token} variant="caption">
                        {mapping.token} → {documentMacroSourceLabel(mapping.source_key)}
                        {mapping.is_required ? " (required)" : ""}
                      </Typography>
                    ))}
                    {(template.macro_mappings || []).length === 0 ? (
                      <Typography variant="caption" color="text.secondary">None</Typography>
                    ) : null}
                    <Button
                      size="small"
                      onClick={() => {
                        setEditingTemplate(template);
                        setEditingMappings((template.macro_mappings || []).map(mapping => ({ ...mapping })));
                      }}
                    >
                      Edit mappings
                    </Button>
                  </Stack>
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
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No document templates configured.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    Loading document templates...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
      <Dialog
        open={!!editingTemplate}
        onClose={() => !saving && setEditingTemplate(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Macro mappings{editingTemplate ? ` — ${editingTemplate.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <DocumentMacroMappingsEditor
            value={editingMappings}
            onChange={setEditingMappings}
            sources={documentMacroSourcesForTrigger(editingTemplate?.trigger_type || "manual")}
            helperText={editingTemplate?.trigger_type === "purchase_order" ? PURCHASE_ORDER_MACRO_HELP : undefined}
            disabled={saving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTemplate(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveMappings} disabled={saving}>
            Save mappings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DocumentTemplatesPage;
