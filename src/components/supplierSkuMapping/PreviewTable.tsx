import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { RowView } from "../../lib/supplierSkuMapping";
import { FLAG_LABELS, StatusChip, formatCurrentSupplierValues, wooStatusLabel } from "./statusDisplay";

type Props = {
  views: RowView[];
  currency: string;
  onSkuChange: (rowId: number, sku: string) => void;
  onIncludeChange: (rowId: number, include: boolean) => void;
  onReplaceChange: (rowId: number, replace: boolean) => void;
  onPickProduct: (rowId: number) => void;
  /** Reset a hand-picked product back to the automatic match, or unmatch an automatic one. */
  onClearManual: (rowId: number) => void;
};

const PAGE_SIZES = [50, 100, 250];

export default function PreviewTable({
  views,
  currency,
  onSkuChange,
  onIncludeChange,
  onReplaceChange,
  onPickProduct,
  onClearManual,
}: Props) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    setPage(0);
  }, [views.length]);

  const visible = views.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper variant="outlined">
      <TableContainer sx={{ maxHeight: "65vh" }}>
        <Table size="small" stickyHeader data-testid="sku-mapping-table">
          <TableHead>
            <TableRow>
              <TableCell>Include</TableCell>
              <TableCell>Supplier SKU</TableCell>
              <TableCell>Supplier name</TableCell>
              <TableCell align="right">Price ({currency})</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell>
                Style <Typography component="span" variant="caption">(Woo: Texture)</Typography>
              </TableCell>
              <TableCell>Colour</TableCell>
              <TableCell>Height</TableCell>
              <TableCell>Matched Woo product</TableCell>
              <TableCell>Current Woo supplier values</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((view) => {
              const { row } = view;
              const disabledReason = view.blockReason;
              return (
                <TableRow key={row.row_id} hover data-testid={`sku-row-${row.row_id}`} selected={view.isManual}>
                  <TableCell padding="checkbox">
                    <Tooltip title={disabledReason ?? ""}>
                      <span>
                        <Checkbox
                          size="small"
                          checked={view.include}
                          disabled={Boolean(disabledReason) && !view.include}
                          onChange={(event) => onIncludeChange(row.row_id, event.target.checked)}
                          inputProps={{ "aria-label": `Include row ${row.row_id}` }}
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ minWidth: 190 }}>
                    <TextField
                      size="small"
                      variant="standard"
                      value={view.sku}
                      onChange={(event) => onSkuChange(row.row_id, event.target.value)}
                      error={Boolean(view.skuProblem) || view.duplicateSku}
                      helperText={view.skuEdited ? `Edited (sheet: ${row.supplier_sku})` : undefined}
                      inputProps={{ "aria-label": `Supplier SKU for row ${row.row_id}` }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Typography variant="body2">{row.supplier_name}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                      {row.flags.map((flag) => (
                        <Chip key={flag} size="small" variant="outlined" label={FLAG_LABELS[flag] ?? flag} />
                      ))}
                      {row.is_suggestion ? <Chip size="small" color="info" variant="outlined" label="Name-based suggestion" /> : null}
                    </Box>
                    {row.warnings.map((warning) => (
                      <Typography key={warning.code} variant="caption" color="warning.main" sx={{ display: "block" }}>
                        {warning.message}
                      </Typography>
                    ))}
                    {row.notes.map((note) => (
                      <Typography key={note} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {note}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell align="right">
                    {row.price === null ? <Chip size="small" color="warning" label={row.price_flag || "TBD"} /> : `$${row.price}`}
                  </TableCell>
                  <TableCell>{row.tier ?? ""}</TableCell>
                  <TableCell>{row.style ?? ""}</TableCell>
                  <TableCell>
                    {row.colour ?? ""}
                    {row.colour_as_sheet && row.colour && row.colour_as_sheet !== row.colour ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        sheet: {row.colour_as_sheet}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.height ?? ""}</TableCell>
                  <TableCell sx={{ minWidth: 230 }}>
                    {view.target ? (
                      <Box>
                        <Typography variant="body2">
                          #{view.target.id} {view.target.sku || "(no SKU)"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {view.target.type} / {wooStatusLabel(view.target.status)}
                          {view.isManual ? " / chosen by hand" : ""}
                        </Typography>
                        {view.sharedTarget ? (
                          <Typography variant="caption" color="error" sx={{ display: "block" }}>
                            Another included row points at this product.
                          </Typography>
                        ) : null}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No product matched
                      </Typography>
                    )}
                    <Box sx={{ mt: 0.5 }}>
                      <Button size="small" onClick={() => onPickProduct(row.row_id)}>
                        {view.target ? "Change" : "Select"}
                      </Button>
                      {view.isManual || view.target ? (
                        <Button size="small" color="inherit" onClick={() => onClearManual(row.row_id)}>
                          {view.isManual ? "Reset" : "Unmatch"}
                        </Button>
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Typography variant="body2">{formatCurrentSupplierValues(view.target)}</Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    <StatusChip status={view.status} />
                    {disabledReason && view.include ? (
                      <Typography variant="caption" color="error" sx={{ display: "block" }}>
                        Cannot commit: {disabledReason}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ minWidth: 190 }}>
                    {view.status === "conflict" && view.target ? (
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={view.replace}
                              onChange={(event) => onReplaceChange(row.row_id, event.target.checked)}
                              inputProps={{ "aria-label": `Replace existing values for row ${row.row_id}` }}
                            />
                          }
                          label="Replace"
                        />
                        <Typography variant="caption" sx={{ display: "block" }}>
                          Before: {formatCurrentSupplierValues(view.target)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          After: supplier / {view.sku} / {row.price === null ? "no price" : `$${row.price}`}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {actionLabel(view)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12}>
                  <Typography variant="body2" color="text.secondary">
                    No rows match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={views.length}
        page={page}
        onPageChange={(_event, next) => setPage(next)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={PAGE_SIZES}
      />
    </Paper>
  );
}

function actionLabel(view: RowView): string {
  switch (view.action) {
    case "write":
      return "Will be written";
    case "replace":
      return "Will replace existing values";
    case "skip_unchanged":
      return "Skipped: values already identical";
    case "skip_conflict":
      return "Skipped: conflict, Replace not ticked";
    case "not_committable":
      return "Not sent";
    default:
      return "Excluded";
  }
}
