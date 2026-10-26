import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { SkuMappingSupplierValues } from "../../api/supplierSkuMappingApi";
import type {
  ActionCounts,
  CommitCountSummary,
  CommitCounts,
  CommitPreviewEntry,
  CommitReportEntry,
  ConflictReplacement,
} from "../../lib/supplierSkuMapping";
import { formatCommitResultLine, summarizeCommitCounts } from "../../lib/supplierSkuMapping";
import WooProductLabel from "./WooProductLabel";

const formatValues = (values: SkuMappingSupplierValues | null) =>
  values
    ? [values.supplier_id !== null ? `supplier ${values.supplier_id}` : "no supplier", values.supplier_sku || "no SKU", values.supplier_price ? `$${values.supplier_price}` : "no price"].join(" / ")
    : "";

type ReplaceProps = {
  open: boolean;
  conflicts: ConflictReplacement[];
  onConfirm: () => void;
  onClose: () => void;
};

/** Shows exactly what "replace all conflicts" would overwrite before it ticks Replace on those rows. */
export function ReplaceConflictsDialog({ open, conflicts, onConfirm, onClose }: ReplaceProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Replace {conflicts.length} conflicting value{conflicts.length === 1 ? "" : "s"}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          These products already hold different supplier values. Ticking Replace overwrites them when you commit. Nothing is written until you commit.
        </Typography>
        <Table size="small" data-testid="replace-conflicts-table">
          <TableHead>
            <TableRow>
              <TableCell>Sheet row</TableCell>
              <TableCell>Woo product</TableCell>
              <TableCell>Before (on the product now)</TableCell>
              <TableCell>After (from the sheet)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {conflicts.map((conflict) => (
              <TableRow key={conflict.rowId}>
                <TableCell>
                  {conflict.rowId}: {conflict.supplierName}
                </TableCell>
                <TableCell>
                  <WooProductLabel product={conflict.product} />
                </TableCell>
                <TableCell>
                  {formatValues({
                    supplier_id: conflict.before.supplierId,
                    supplier_sku: conflict.before.supplierSku,
                    supplier_price: conflict.before.supplierPrice,
                  })}
                </TableCell>
                <TableCell>
                  {conflict.after.supplierSku} / {conflict.after.supplierPrice ? `$${conflict.after.supplierPrice}` : "no price"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={onConfirm} disabled={conflicts.length === 0}>
          Tick Replace on these rows
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ConfirmProps = {
  open: boolean;
  counts: ActionCounts;
  /** The rows that will be sent, each with the named Woo product it will be written to. */
  entries: CommitPreviewEntry[];
  supplierName: string;
  committing: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function CommitConfirmDialog({ open, counts, entries, supplierName, committing, onConfirm, onClose }: ConfirmProps) {
  const toSend = counts.write + counts.replace;
  return (
    <Dialog open={open} onClose={committing ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Commit to WooCommerce?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          This writes the {supplierName} Supplier SKU and Supplier price onto the matched WooCommerce products and variations.
        </Typography>
        <Table size="small" data-testid="commit-confirm-counts">
          <TableBody>
            <TableRow>
              <TableCell>New values to write</TableCell>
              <TableCell align="right">{counts.write}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Existing values to replace (conflicts with Replace ticked)</TableCell>
              <TableCell align="right">{counts.replace}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Skipped: already identical</TableCell>
              <TableCell align="right">{counts.skip_unchanged}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Skipped: conflict, Replace not ticked</TableCell>
              <TableCell align="right">{counts.skip_conflict}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Included but cannot be committed (see the table)</TableCell>
              <TableCell align="right">{counts.not_committable}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Excluded</TableCell>
              <TableCell align="right">{counts.excluded}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {entries.length > 0 ? (
          <Box sx={{ mt: 2, maxHeight: 320, overflow: "auto" }}>
            <Table size="small" stickyHeader data-testid="commit-confirm-rows">
              <TableHead>
                <TableRow>
                  <TableCell>Woo product</TableCell>
                  <TableCell>Will write</TableCell>
                  <TableCell>Sheet row</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.rowId}>
                    <TableCell>
                      <WooProductLabel product={entry.product} />
                    </TableCell>
                    <TableCell>
                      {entry.supplierSku} / ${entry.price}
                      {entry.replace ? " (replaces existing values)" : ""}
                    </TableCell>
                    <TableCell>
                      {entry.rowId}: {entry.supplierName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
        {counts.not_committable > 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Rows that cannot be committed are not sent. Fix them first, or untick them, if you want them included.
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={committing}>
          Cancel
        </Button>
        <Button
          data-testid="sku-commit-dialog-button"
          variant="contained"
          color="primary"
          onClick={onConfirm}
          disabled={committing || toSend === 0}
          startIcon={committing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {committing ? `Committing ${toSend} row${toSend === 1 ? "" : "s"}...` : `Commit ${toSend} row${toSend === 1 ? "" : "s"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const OUTCOME_LABELS: Record<CommitReportEntry["outcome"], { label: string; color: "success" | "default" | "warning" | "error" }> = {
  updated: { label: "Updated", color: "success" },
  unchanged: { label: "Unchanged", color: "default" },
  conflict_skipped: { label: "Conflict skipped", color: "warning" },
  error: { label: "Error", color: "error" },
  skipped_unchanged: { label: "Skipped: identical", color: "default" },
  skipped_conflict: { label: "Skipped: conflict", color: "warning" },
  skipped_not_committable: { label: "Not committed", color: "warning" },
};

type ResultsProps = {
  entries: CommitReportEntry[];
  counts: CommitCounts | null;
  error?: string | null;
  onDismiss: () => void;
};

function resultSeverity(error: string | null | undefined, summary: CommitCountSummary | null): "error" | "warning" | "success" {
  if (error) return "error";
  if (summary && summary.failed > 0) return "warning";
  return "success";
}

export function CommitResults({ entries, counts, error, onDismiss }: ResultsProps) {
  const summary = summarizeCommitCounts(counts);
  const headline = error
    ? summary
      ? `The commit failed: ${error} ${formatCommitResultLine(summary)}`
      : `The commit failed: ${error}`
    : summary
      ? formatCommitResultLine(summary)
      : "Commit result";
  return (
    <Box
      data-testid="commit-results"
      sx={{
        position: "sticky",
        top: { xs: 56, sm: 64 },
        zIndex: 20,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Alert
        data-testid="commit-result-alert"
        severity={resultSeverity(error, summary)}
        sx={{ mb: entries.length > 0 ? 2 : 0 }}
        action={
          <Button size="small" color="inherit" onClick={onDismiss}>
            Hide result
          </Button>
        }
      >
        {headline}
      </Alert>
      {summary ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
          <Chip size="small" color="success" label={`Updated ${summary.updated}`} />
          <Chip size="small" label={`Skipped ${summary.skipped}`} />
          <Chip size="small" color={summary.failed > 0 ? "error" : "default"} label={`Failed ${summary.failed}`} />
        </Box>
      ) : null}
      {entries.length > 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Rows that were written now show as Unchanged. Use Preview to re-read the sheet from WooCommerce.
        </Typography>
      ) : null}
      {entries.length > 0 ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sheet row</TableCell>
              <TableCell>Supplier SKU</TableCell>
              <TableCell>Woo product</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Before</TableCell>
              <TableCell>After</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => {
              const display = OUTCOME_LABELS[entry.outcome];
              return (
                <TableRow key={entry.rowId}>
                  <TableCell>
                    {entry.rowId}: {entry.supplierName}
                  </TableCell>
                  <TableCell>{entry.supplierSku}</TableCell>
                  <TableCell>
                    {entry.wooProduct ? <WooProductLabel product={entry.wooProduct} /> : entry.wooId ? `#${entry.wooId} ${entry.wooSku}` : ""}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={display.color} label={display.label} />
                  </TableCell>
                  <TableCell>{formatValues(entry.before)}</TableCell>
                  <TableCell>{formatValues(entry.after)}</TableCell>
                  <TableCell>{entry.message}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
    </Box>
  );
}
