import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SkuMappingPreview, SkuMappingStatus } from "../../api/supplierSkuMappingApi";
import { STATUS_LABELS, STATUS_ORDER, type ViewFilter } from "../../lib/supplierSkuMapping";
import { STATUS_COLORS, wooStatusLabel } from "./statusDisplay";

type Props = {
  preview: SkuMappingPreview;
  statusCounts: Record<SkuMappingStatus, number>;
  filter: ViewFilter;
  onFilterChange: (filter: ViewFilter) => void;
  families: Array<{ value: string; label: string }>;
};

const STAT_LABELS: Record<string, string> = {
  pages: "Pages",
  data_rows: "Data rows",
  colour_headers: "Colour headings",
  skipped_blank_rows: "Blank rows skipped",
  tbd_prices: "Price TBD",
  retiring_headers: "Retiring headings",
  bracket_skus_cleaned: "Stray [ removed from SKU",
};

export default function PreviewSummary({ preview, statusCounts, filter, onFilterChange, families }: Props) {
  const unresolved = preview.family_resolution.filter((family) => !family.resolved);

  const toggleStatus = (status: SkuMappingStatus) => {
    const next = filter.statuses.includes(status)
      ? filter.statuses.filter((existing) => existing !== status)
      : [...filter.statuses, status];
    onFilterChange({ ...filter, statuses: next });
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Parsed from the sheet
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }} data-testid="parse-stats">
          {Object.entries(preview.parse.stats).map(([key, value]) => (
            <Chip key={key} size="small" variant="outlined" label={`${STAT_LABELS[key] ?? key}: ${value}`} />
          ))}
        </Box>
        {preview.plugin_version ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            WordPress plugin {preview.plugin_version}
            {preview.run_id ? ` / preview run ${preview.run_id}` : ""}
          </Typography>
        ) : null}
      </Paper>

      {unresolved.length > 0 ? (
        <Alert severity="error">
          {unresolved.map((family) => (
            <Typography key={family.family} variant="body2">
              {family.label}: {family.problem ?? "The WooCommerce parent product could not be identified."}
            </Typography>
          ))}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Status (click to filter)
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          {STATUS_ORDER.map((status) => {
            const active = filter.statuses.includes(status);
            return (
              <Chip
                key={status}
                label={`${STATUS_LABELS[status]}: ${statusCounts[status]}`}
                color={STATUS_COLORS[status]}
                variant={active ? "filled" : "outlined"}
                onClick={() => toggleStatus(status)}
                data-testid={`filter-${status}`}
              />
            );
          })}
          {filter.statuses.length > 0 ? (
            <Chip label="Clear status filter" onClick={() => onFilterChange({ ...filter, statuses: [] })} />
          ) : null}
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label="Family"
            value={filter.family}
            onChange={(event) => onFilterChange({ ...filter, family: event.target.value })}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All families</MenuItem>
            {families.map((family) => (
              <MenuItem key={family.value} value={family.value}>
                {family.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search SKU, name, colour or Woo SKU"
            value={filter.search}
            onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
            sx={{ minWidth: 320 }}
          />
        </Box>
      </Paper>

      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Value aliases used when matching ({preview.aliases.length}, read-only)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Matching uses attribute term names, not slugs. These are the only substitutions applied; anything else must match exactly.
          </Typography>
          <Table size="small" data-testid="alias-table">
            <TableHead>
              <TableRow>
                <TableCell>Sheet says</TableCell>
                <TableCell>Matched to Woo value</TableCell>
                <TableCell>Applies to</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.aliases.map((alias) => (
                <TableRow key={`${alias.applies_to}-${alias.supplier_value}`}>
                  <TableCell>{alias.supplier_value}</TableCell>
                  <TableCell>{alias.woo_value}</TableCell>
                  <TableCell>{alias.applies_to}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>

      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            Woo variations with no sheet row ({preview.woo_without_supplier_row.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {preview.woo_without_supplier_row.length === 0 ? (
            <Typography variant="body2">Every Woo variation in the matched families has a sheet row.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Woo id</TableCell>
                  <TableCell>Woo SKU</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.woo_without_supplier_row.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{wooStatusLabel(item.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
