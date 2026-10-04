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
  { value: "created_date", label: "Created date" },
  { value: "supplier_name", label: "Supplier name" },
  { value: "supplier_contact_name", label: "Supplier contact name" },
  { value: "supplier_email", label: "Supplier email" },
  { value: "supplier_currency", label: "Supplier currency" },
  { value: "shipping_type", label: "Shipping type" },
  { value: "lead_time_days", label: "Lead time days" },
  { value: "eta_date", label: "ETA date" },
  { value: "supplier_order_number", label: "Supplier order number" },
  { value: "product_cost", label: "Product cost" },
  { value: "shipping_cost", label: "Shipping cost" },
  { value: "cost_adjustments", label: "Cost adjustments" },
  { value: "total_cost", label: "Total cost" },
  { value: "line_number", label: "Line number" },
  { value: "supplier_sku", label: "Supplier SKU" },
  { value: "sku", label: "SKU" },
  { value: "product_name", label: "Product name" },
  { value: "qty", label: "Quantity" },
  { value: "supplier_unit_price", label: "Supplier price" },
  { value: "line_total", label: "Line total" },
];

export const DEFAULT_PURCHASE_ORDER_MACRO_MAPPINGS: DocumentMacroMapping[] = [
  { token: "{po_number}", source_key: "po_number", is_required: true },
  { token: "{created_date}", source_key: "created_date", is_required: true },
  { token: "{supplier_name}", source_key: "supplier_name", is_required: true },
  { token: "{supplier_contact_name}", source_key: "supplier_contact_name", is_required: false },
  { token: "{supplier_email}", source_key: "supplier_email", is_required: false },
  { token: "{supplier_currency}", source_key: "supplier_currency", is_required: true },
  { token: "{shipping_type}", source_key: "shipping_type", is_required: false },
  { token: "{lead_time_days}", source_key: "lead_time_days", is_required: false },
  { token: "{eta_date}", source_key: "eta_date", is_required: false },
  { token: "{supplier_order_number}", source_key: "supplier_order_number", is_required: false },
  { token: "{product_cost}", source_key: "product_cost", is_required: false },
  { token: "{shipping_cost}", source_key: "shipping_cost", is_required: false },
  { token: "{cost_adjustments}", source_key: "cost_adjustments", is_required: false },
  { token: "{total_cost}", source_key: "total_cost", is_required: false },
  { token: "{line_number}", source_key: "line_number", is_required: true },
  { token: "{supplier_sku}", source_key: "supplier_sku", is_required: false },
  { token: "{sku}", source_key: "sku", is_required: true },
  { token: "{product_name}", source_key: "product_name", is_required: true },
  { token: "{qty}", source_key: "qty", is_required: true },
  { token: "{supplier_unit_price}", source_key: "supplier_unit_price", is_required: false },
  { token: "{line_total}", source_key: "line_total", is_required: true },
];

const OPTIONAL_PURCHASE_ORDER_SOURCES = new Set<DocumentMacroSource>([
  "supplier_sku",
  "supplier_unit_price",
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
