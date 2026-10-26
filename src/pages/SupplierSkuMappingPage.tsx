import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { ApiRequestError } from "../api/httpClient";
import { Supplier, suppliersApi } from "../api/suppliersApi";
import {
  supplierSkuMappingApi,
  type SkuMappingCandidate,
  type SkuMappingCommitResponse,
  type SkuMappingPreview,
} from "../api/supplierSkuMappingApi";
import {
  applyWrittenValues,
  buildCommitPreview,
  buildCommitReport,
  buildCommitRows,
  commitCountsFromUnknown,
  countActions,
  countByStatus,
  deriveRowViews,
  filterViews,
  replaceableConflicts,
  setReplaceForRows,
  updateRowEdit,
  type CommitCounts,
  type CommitReportEntry,
  type RowEdits,
  type ViewFilter,
} from "../lib/supplierSkuMapping";
import PreviewSummary from "../components/supplierSkuMapping/PreviewSummary";
import PreviewTable from "../components/supplierSkuMapping/PreviewTable";
import ManualSelectDialog from "../components/supplierSkuMapping/ManualSelectDialog";
import {
  CommitConfirmDialog,
  CommitResults,
  ReplaceConflictsDialog,
} from "../components/supplierSkuMapping/CommitDialogs";

type ParseFailureDetail = { page: number; row_text: string; reason: string };
type PageError = { message: string; failures: ParseFailureDetail[] };

const EMPTY_FILTER: ViewFilter = { statuses: [], family: "", search: "" };

function describeError(error: unknown): PageError {
  if (error instanceof ApiRequestError) {
    const body = error.responseBody as { detail?: unknown } | null;
    const detail = body && typeof body === "object" ? body.detail : undefined;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const parsed = detail as { message?: string; failures?: ParseFailureDetail[] };
      return {
        message: parsed.message ?? error.message,
        failures: Array.isArray(parsed.failures) ? parsed.failures : [],
      };
    }
    if (typeof detail === "string") return { message: detail, failures: [] };
    return { message: error.message, failures: [] };
  }
  return { message: error instanceof Error ? error.message : String(error), failures: [] };
}

function humaniseFamily(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function SupplierSkuMappingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [sheetId, setSheetId] = useState("");
  const [sheetTab, setSheetTab] = useState("");
  const [savingSheet, setSavingSheet] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<SkuMappingPreview | null>(null);
  const [pageError, setPageError] = useState<PageError | null>(null);
  const [edits, setEdits] = useState<RowEdits>({});
  const [filter, setFilter] = useState<ViewFilter>(EMPTY_FILTER);
  const [pickRowId, setPickRowId] = useState<number | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitErrorCounts, setCommitErrorCounts] = useState<CommitCounts | null>(null);
  const [commitResult, setCommitResult] = useState<{ response: SkuMappingCommitResponse; entries: CommitReportEntry[] } | null>(null);
  const commitResultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    suppliersApi
      .getAll()
      .then((list) => {
        if (cancelled) return;
        setSuppliers(list);
        const greenstalk = list.find((supplier) => supplier.name.toLowerCase().includes("greenstalk"));
        setSupplierId(greenstalk ? greenstalk.id : "");
      })
      .catch((error) => {
        if (!cancelled) setPageError(describeError(error));
      })
      .finally(() => {
        if (!cancelled) setSuppliersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const supplier = suppliers.find((entry) => entry.id === supplierId) ?? null;
  const savedSheetId = supplier?.catalog_spreadsheet_id ?? "";
  const savedSheetTab = supplier?.catalog_sheet_tab ?? "";
  const sheetDirty = sheetId.trim() !== savedSheetId || sheetTab.trim() !== savedSheetTab;
  const effectiveSupplierId = preview?.supplier.id ?? (supplierId === "" ? 0 : supplierId);

  useEffect(() => {
    setSheetId(savedSheetId);
    setSheetTab(savedSheetTab);
  }, [savedSheetId, savedSheetTab]);

  const views = useMemo(
    () => (preview ? deriveRowViews(preview.rows, edits, preview.supplier.id) : []),
    [preview, edits],
  );
  const statusCounts = useMemo(() => countByStatus(views), [views]);
  const actionCounts = useMemo(() => countActions(views), [views]);
  const filteredViews = useMemo(() => filterViews(views, filter), [views, filter]);
  const conflicts = useMemo(() => replaceableConflicts(views), [views]);
  const commitPreviewEntries = useMemo(() => buildCommitPreview(views), [views]);
  const families = useMemo(() => {
    if (!preview) return [];
    const labels = new Map(preview.family_resolution.map((family) => [family.family, family.label]));
    const values = Array.from(new Set(preview.rows.map((row) => row.family)));
    return values.map((value) => ({ value, label: labels.get(value) ?? humaniseFamily(value) }));
  }, [preview]);
  const pickRow = preview?.rows.find((row) => row.row_id === pickRowId) ?? null;

  const resetPreview = useCallback(() => {
    setPreview(null);
    setEdits({});
    setFilter(EMPTY_FILTER);
    setCommitResult(null);
    setCommitError(null);
    setCommitErrorCounts(null);
  }, []);

  useEffect(() => {
    if (!commitResult && !commitError) return;
    commitResultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [commitResult, commitError]);

  const handleSupplierChange = (value: number) => {
    setSupplierId(value);
    setPageError(null);
    resetPreview();
  };

  const handleSaveSheet = async () => {
    if (!supplier) return;
    setSavingSheet(true);
    setPageError(null);
    try {
      const updated = await suppliersApi.update(supplier.id, {
        name: supplier.name,
        catalog_spreadsheet_id: sheetId.trim(),
        catalog_sheet_tab: sheetTab.trim(),
      });
      setSuppliers((current) =>
        current.map((entry) => (entry.id === supplier.id ? { ...entry, ...updated, id: supplier.id } : entry)),
      );
      resetPreview();
    } catch (error) {
      setPageError(describeError(error));
    } finally {
      setSavingSheet(false);
    }
  };

  const handlePreview = async () => {
    if (supplierId === "" || !savedSheetId || !savedSheetTab) return;
    setPreviewing(true);
    setPageError(null);
    resetPreview();
    try {
      setPreview(await supplierSkuMappingApi.preview(supplierId));
    } catch (error) {
      setPageError(describeError(error));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSelectProduct = (rowId: number, candidate: SkuMappingCandidate) => {
    setEdits((current) => updateRowEdit(current, rowId, { manualTarget: candidate, include: true, replace: false }));
    setPickRowId(null);
  };

  const handleClearManual = (rowId: number) => {
    const view = views.find((entry) => entry.row.row_id === rowId);
    // A hand-picked product resets to the automatic match; an automatic match is unmatched.
    setEdits((current) =>
      updateRowEdit(
        current,
        rowId,
        view?.isManual
          ? { manualTarget: undefined, include: undefined, replace: false }
          : { manualTarget: null, include: false, replace: false },
      ),
    );
  };

  const handleReplaceAll = () => {
    setEdits((current) => setReplaceForRows(current, conflicts.map((conflict) => conflict.rowId), true));
    setReplaceDialogOpen(false);
  };

  const handleCommit = async () => {
    const commitRows = buildCommitRows(views, effectiveSupplierId);
    if (commitRows.length === 0) return;
    setCommitting(true);
    setCommitError(null);
    setCommitErrorCounts(null);
    try {
      const response = await supplierSkuMappingApi.commit(commitRows);
      const applied = applyWrittenValues(preview?.rows ?? [], edits, views, response, commitRows);
      if (preview) {
        setPreview({ ...preview, rows: applied.rows });
        setEdits(applied.edits);
      }
      setCommitResult({ response, entries: buildCommitReport(views, response) });
      setConfirmOpen(false);
    } catch (error) {
      setCommitResult(null);
      setCommitError(describeError(error).message);
      setCommitErrorCounts(commitCountsFromUnknown(error instanceof ApiRequestError ? error.responseBody : error));
      setConfirmOpen(false);
    } finally {
      setCommitting(false);
    }
  };

  const toCommit = actionCounts.write + actionCounts.replace;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5">Supplier SKU Mapping</Typography>
        <Typography variant="body2" color="text.secondary">
          Read the catalog Google Sheet saved on the supplier, review how each row matches a WooCommerce product, then commit
          the Supplier SKU and Supplier price onto the products. Nothing is written until you commit. Every request and
          response is visible in the API debug panel.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            select
            size="small"
            label="Supplier"
            value={supplierId}
            onChange={(event) => handleSupplierChange(Number(event.target.value))}
            disabled={suppliersLoading}
            sx={{ minWidth: 240 }}
          >
            {suppliers.map((entry) => (
              <MenuItem key={entry.id} value={entry.id}>
                {entry.name} ({entry.default_currency})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Spreadsheet id"
            value={sheetId}
            onChange={(event) => setSheetId(event.target.value)}
            sx={{ minWidth: 360 }}
          />
          <TextField
            size="small"
            label="Tab name"
            value={sheetTab}
            onChange={(event) => setSheetTab(event.target.value)}
            sx={{ minWidth: 180 }}
          />
          <Button variant="outlined" onClick={handleSaveSheet} disabled={!supplier || savingSheet || !sheetDirty}>
            {savingSheet ? "Saving..." : "Save sheet"}
          </Button>
          <Button
            variant="contained"
            onClick={handlePreview}
            disabled={supplierId === "" || !savedSheetId || !savedSheetTab || previewing}
          >
            {previewing ? "Parsing and matching..." : "Preview"}
          </Button>
          {previewing ? <CircularProgress size={22} /> : null}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Preview reads the spreadsheet id and tab saved on this supplier.
          {sheetDirty ? " Save the sheet location before a preview will use these edits." : " PDF upload is not used."}
        </Typography>
      </Paper>

      {pageError ? (
        <Alert severity="error" data-testid="sku-page-error" onClose={() => setPageError(null)}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {pageError.message}
          </Typography>
          {pageError.failures.length > 0 ? (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Page</TableCell>
                  <TableCell>Row text</TableCell>
                  <TableCell>Problem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageError.failures.map((failure, index) => (
                  <TableRow key={`${failure.page}-${index}`}>
                    <TableCell>{failure.page}</TableCell>
                    <TableCell>{failure.row_text}</TableCell>
                    <TableCell>{failure.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Alert>
      ) : null}

      {commitError || commitResult ? (
        <Box ref={commitResultRef}>
          <CommitResults
            entries={commitResult?.entries ?? []}
            counts={commitResult?.response.counts ?? commitErrorCounts}
            error={commitError}
            onDismiss={() => {
              setCommitResult(null);
              setCommitError(null);
              setCommitErrorCounts(null);
            }}
          />
        </Box>
      ) : null}

      {preview?.reference_diff ? (
        <Alert severity="info" data-testid="sku-reference-diff">
          <Typography variant="body2">
            {preview.reference_diff.reference_label}: sheet {preview.reference_diff.sheet_row_count} rows, PDF{" "}
            {preview.reference_diff.pdf_row_count} rows. SKUs only on the sheet:{" "}
            {preview.reference_diff.skus_only_on_sheet.join(", ") || "none"}. SKUs only in the PDF:{" "}
            {preview.reference_diff.skus_only_in_pdf.join(", ") || "none"}.
          </Typography>
        </Alert>
      ) : null}

      {preview ? (
        <>
          <PreviewSummary preview={preview} statusCounts={statusCounts} filter={filter} onFilterChange={setFilter} families={families} />

          <Paper variant="outlined" sx={{ p: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {views.length} rows. To commit: {actionCounts.write} new, {actionCounts.replace} replacing, skipping{" "}
              {actionCounts.skip_unchanged} identical and {actionCounts.skip_conflict} conflicts.
              Showing {filteredViews.length}.
            </Typography>
            <Button variant="outlined" color="warning" disabled={conflicts.length === 0} onClick={() => setReplaceDialogOpen(true)}>
              Replace all conflicts ({conflicts.length})
            </Button>
            <Button
              data-testid="sku-commit-page-button"
              variant="contained"
              disabled={toCommit === 0 || committing}
              onClick={() => setConfirmOpen(true)}
              startIcon={committing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {committing
                ? `Committing ${toCommit} row${toCommit === 1 ? "" : "s"}...`
                : `Commit ${toCommit} row${toCommit === 1 ? "" : "s"}...`}
            </Button>
          </Paper>

          <PreviewTable
            views={filteredViews}
            currency={preview.supplier.default_currency}
            onSkuChange={(rowId, sku) => setEdits((current) => updateRowEdit(current, rowId, { sku }))}
            onIncludeChange={(rowId, include) => setEdits((current) => updateRowEdit(current, rowId, { include }))}
            onReplaceChange={(rowId, replace) => setEdits((current) => updateRowEdit(current, rowId, { replace }))}
            onPickProduct={setPickRowId}
            onClearManual={handleClearManual}
          />
        </>
      ) : null}

      <ManualSelectDialog
        row={pickRow}
        candidates={preview?.candidates ?? []}
        onSelect={handleSelectProduct}
        onClose={() => setPickRowId(null)}
      />
      <ReplaceConflictsDialog
        open={replaceDialogOpen}
        conflicts={conflicts}
        onConfirm={handleReplaceAll}
        onClose={() => setReplaceDialogOpen(false)}
      />
      <CommitConfirmDialog
        open={confirmOpen}
        counts={actionCounts}
        entries={commitPreviewEntries}
        supplierName={preview?.supplier.name ?? ""}
        committing={committing}
        onConfirm={handleCommit}
        onClose={() => setConfirmOpen(false)}
      />
    </Box>
  );
}
