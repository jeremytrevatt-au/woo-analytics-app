import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import {
  Button,
  Checkbox,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  DocumentMacroMapping,
  DocumentMacroSource,
} from "../api/documentTemplatesApi";

export const DOCUMENT_MACRO_SOURCES: Array<{
  value: DocumentMacroSource;
  label: string;
}> = [
  { value: "billing_first_name", label: "Billing first name" },
  { value: "shipping_first_name", label: "Shipping first name" },
  { value: "billing_last_name", label: "Billing last name" },
  { value: "shipping_last_name", label: "Shipping last name" },
  { value: "billing_company", label: "Billing company" },
  { value: "order_number", label: "Order number" },
];

export const PURCHASE_ORDER_MACRO_SOURCES: Array<{
  value: DocumentMacroSource;
  label: string;
}> = [
  { value: "po_number", label: "PO number" },
  { value: "po_created_date", label: "Created date" },
  { value: "po_supplier_name", label: "Supplier name" },
  { value: "po_supplier_firstname", label: "Supplier first name" },
  { value: "po_supplier_contact_name", label: "Supplier contact name" },
  { value: "po_supplier_email", label: "Supplier email" },
  { value: "po_supplier_currency", label: "Supplier currency" },
  { value: "po_shipping_type", label: "Shipping type" },
  { value: "po_lead_time_days", label: "Lead time days" },
  { value: "po_eta_date", label: "ETA date" },
  { value: "po_supplier_order_number", label: "Supplier order number" },
  { value: "po_product_cost", label: "Product cost" },
  { value: "po_shipping_cost", label: "Shipping cost" },
  { value: "po_cost_adjustments", label: "Cost adjustments" },
  { value: "po_total_price", label: "Total price" },
  { value: "po_line_number", label: "Line number" },
  { value: "po_supplier_sku", label: "Supplier SKU" },
  { value: "po_sku", label: "SKU" },
  { value: "po_product_description", label: "Product description" },
  { value: "po_qty", label: "Quantity" },
  { value: "po_supplier_unit_price", label: "Supplier price" },
  { value: "po_line_total", label: "Line total" },
];

export const DEFAULT_PURCHASE_ORDER_MACRO_MAPPINGS: DocumentMacroMapping[] = [
  { token: "{po_number}", source_key: "po_number", is_required: true },
  { token: "{po_created_date}", source_key: "po_created_date", is_required: true },
  { token: "{po_supplier_name}", source_key: "po_supplier_name", is_required: true },
  { token: "{po_supplier_firstname}", source_key: "po_supplier_firstname", is_required: false },
  { token: "{po_supplier_contact_name}", source_key: "po_supplier_contact_name", is_required: false },
  { token: "{po_supplier_email}", source_key: "po_supplier_email", is_required: false },
  { token: "{po_supplier_currency}", source_key: "po_supplier_currency", is_required: true },
  { token: "{po_shipping_type}", source_key: "po_shipping_type", is_required: false },
  { token: "{po_lead_time_days}", source_key: "po_lead_time_days", is_required: false },
  { token: "{po_eta_date}", source_key: "po_eta_date", is_required: false },
  { token: "{po_supplier_order_number}", source_key: "po_supplier_order_number", is_required: false },
  { token: "{po_product_cost}", source_key: "po_product_cost", is_required: false },
  { token: "{po_shipping_cost}", source_key: "po_shipping_cost", is_required: false },
  { token: "{po_cost_adjustments}", source_key: "po_cost_adjustments", is_required: false },
  { token: "{po_total_price}", source_key: "po_total_price", is_required: true },
  { token: "{po_line_number}", source_key: "po_line_number", is_required: true },
  { token: "{po_supplier_sku}", source_key: "po_supplier_sku", is_required: false },
  { token: "{po_sku}", source_key: "po_sku", is_required: true },
  { token: "{po_product_description}", source_key: "po_product_description", is_required: true },
  { token: "{po_qty}", source_key: "po_qty", is_required: true },
  { token: "{po_supplier_unit_price}", source_key: "po_supplier_unit_price", is_required: false },
  { token: "{po_line_total}", source_key: "po_line_total", is_required: true },
];

const OPTIONAL_PURCHASE_ORDER_SOURCES = new Set<DocumentMacroSource>([
  "po_supplier_sku",
  "po_supplier_unit_price",
  "po_supplier_firstname",
]);

export function documentMacroSourcesForTrigger(triggerType: string) {
  return triggerType === "purchase_order"
    ? PURCHASE_ORDER_MACRO_SOURCES
    : DOCUMENT_MACRO_SOURCES;
}

export function documentMacroSourceLabel(sourceKey: string): string {
  return (
    [...DOCUMENT_MACRO_SOURCES, ...PURCHASE_ORDER_MACRO_SOURCES]
      .find((source) => source.value === sourceKey)?.label
    || sourceKey
  );
}

export const DEFAULT_DOCUMENT_MACRO_MAPPING: DocumentMacroMapping = {
  token: "{firstname}",
  source_key: "billing_first_name",
  is_required: true,
};

type Props = {
  value: DocumentMacroMapping[];
  onChange: (value: DocumentMacroMapping[]) => void;
  sources?: Array<{ value: DocumentMacroSource; label: string }>;
  helperText?: string;
  disabled?: boolean;
};

export default function DocumentMacroMappingsEditor({
  value,
  onChange,
  sources = DOCUMENT_MACRO_SOURCES,
  helperText = "Tokens are replaced from authoritative WooCommerce order fields before the PDF is printed.",
  disabled = false,
}: Props) {
  const update = (
    index: number,
    patch: Partial<DocumentMacroMapping>,
  ) => {
    onChange(value.map((mapping, mappingIndex) => {
      if (mappingIndex !== index) return mapping;
      const next = { ...mapping, ...patch };
      if (OPTIONAL_PURCHASE_ORDER_SOURCES.has(next.source_key)) {
        next.is_required = false;
      }
      return next;
    }));
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Macro substitution mappings</Typography>
      <Typography variant="caption" color="text.secondary">
        {helperText}
      </Typography>
      {value.map((mapping, index) => (
        <Stack
          key={`${mapping.id ?? "new"}-${index}`}
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <TextField
            label="Token"
            size="small"
            value={mapping.token}
            disabled={disabled}
            onChange={(event) => update(index, { token: event.target.value })}
            helperText="Example: {firstname}"
            sx={{ minWidth: 190 }}
          />
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Source field</InputLabel>
            <Select
              label="Source field"
              value={mapping.source_key}
              disabled={disabled}
              onChange={(event) => update(index, {
                source_key: event.target.value as DocumentMacroSource,
              })}
            >
              {sources.map((source) => (
                <MenuItem key={source.value} value={source.value}>
                  {source.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" alignItems="center">
            <Checkbox
              checked={mapping.is_required}
              disabled={disabled || OPTIONAL_PURCHASE_ORDER_SOURCES.has(mapping.source_key)}
              onChange={(event) => update(index, {
                is_required: event.target.checked,
              })}
              inputProps={{ "aria-label": `Require ${mapping.token || "macro"}` }}
            />
            <Typography variant="body2">Required</Typography>
          </Stack>
          <IconButton
            aria-label={`Remove ${mapping.token || "macro"} mapping`}
            disabled={disabled}
            onClick={() => onChange(value.filter((_, mappingIndex) => mappingIndex !== index))}
          >
            <DeleteOutline />
          </IconButton>
        </Stack>
      ))}
      <Button
        size="small"
        variant="outlined"
        startIcon={<Add />}
        disabled={disabled}
        onClick={() => onChange([
          ...value,
          {
            token: "{macro}",
            source_key: sources[0]?.value || "billing_first_name",
            is_required: !OPTIONAL_PURCHASE_ORDER_SOURCES.has(
              sources[0]?.value || "billing_first_name",
            ),
          },
        ])}
        sx={{ alignSelf: "flex-start" }}
      >
        Add mapping
      </Button>
    </Stack>
  );
}
