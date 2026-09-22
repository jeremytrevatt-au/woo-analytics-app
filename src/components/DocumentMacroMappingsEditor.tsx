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

export const DEFAULT_DOCUMENT_MACRO_MAPPING: DocumentMacroMapping = {
  token: "{firstname}",
  source_key: "billing_first_name",
  is_required: true,
};

type Props = {
  value: DocumentMacroMapping[];
  onChange: (value: DocumentMacroMapping[]) => void;
  disabled?: boolean;
};

export default function DocumentMacroMappingsEditor({
  value,
  onChange,
  disabled = false,
}: Props) {
  const update = (
    index: number,
    patch: Partial<DocumentMacroMapping>,
  ) => {
    onChange(value.map((mapping, mappingIndex) => (
      mappingIndex === index ? { ...mapping, ...patch } : mapping
    )));
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Macro substitution mappings</Typography>
      <Typography variant="caption" color="text.secondary">
        Tokens are replaced from authoritative WooCommerce order fields before the PDF is printed.
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
            <InputLabel>WooCommerce field</InputLabel>
            <Select
              label="WooCommerce field"
              value={mapping.source_key}
              disabled={disabled}
              onChange={(event) => update(index, {
                source_key: event.target.value as DocumentMacroSource,
              })}
            >
              {DOCUMENT_MACRO_SOURCES.map((source) => (
                <MenuItem key={source.value} value={source.value}>
                  {source.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" alignItems="center">
            <Checkbox
              checked={mapping.is_required}
              disabled={disabled}
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
            source_key: "billing_first_name",
            is_required: true,
          },
        ])}
        sx={{ alignSelf: "flex-start" }}
      >
        Add mapping
      </Button>
    </Stack>
  );
}
