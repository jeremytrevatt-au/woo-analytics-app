import { useCallback, useEffect, useState } from "react";
import { Alert, Stack, Typography, Button, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Chip, IconButton, Collapse, Link, TextField, MenuItem, Checkbox, FormControlLabel, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { existingPurchaseOrderSheetLink, parsePurchaseOrderReceiveStockResult, purchaseOrderPdfExportMessage, purchaseOrderSheetExportMessage, purchaseOrderSheetLinkPatch, purchaseOrdersApi, PurchaseOrder, PurchaseOrderLine, PurchaseOrderReceiveStockResult, PurchaseOrderSheetAudience } from "../api/purchaseOrdersApi";
import { ApiRequestError } from "../api/httpClient";
import { AllocationStatus, preordersApi, PurchaseOrderPreorderLineSummary, PurchaseOrderPreorderSummary, ReserveDepositType } from "../api/preordersApi";
import LoadStateBlock from "../components/LoadStateBlock";
import PurchaseOrderModal from "../components/PurchaseOrderModal";
import { filterPurchaseOrderLines, wooProductEditUrl } from "../lib/purchaseOrderProductSearch";
import { openCreatingSheetTab, openSavedSheet } from "../lib/purchaseOrderSheetTab";

const allocationStatuses: AllocationStatus[] = ["active", "paused", "closed", "cancelled"];
type LineSortKey = "sku" | "product_name" | "qty" | "stock_qty" | "days_of_cover" | "needs_reorder" | "allocated" | "reserved" | "available" | "status" | "reserve";
type SortDirection = "asc" | "desc";

function exportUrlFromError(error: unknown, field: "spreadsheet_url" | "pdf_url"): string {
  if (!(error instanceof ApiRequestError) || !error.responseBody || typeof error.responseBody !== "object") {
    return "";
  }
  const detail = (error.responseBody as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object" || !(field in detail)) {
    return "";
  }
  const url = (detail as Record<string, unknown>)[field];
  return typeof url === "string" ? url : "";
}

function qty(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
}

function receivePreviewFromError(error: unknown): PurchaseOrderReceiveStockResult | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }
  const body = error.responseBody as { detail?: { preview?: unknown } } | null;
  if (!body?.detail?.preview) {
    return null;
  }
  try {
    return parsePurchaseOrderReceiveStockResult(body.detail.preview);
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function lineTotals(summary?: PurchaseOrderPreorderLineSummary) {
  const allocations = summary?.allocations ?? [];
  return {
    allocated: allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_qty || 0), 0),
    reserved: allocations.reduce((sum, allocation) => sum + Number(allocation.reserved_qty || 0), 0),
    available: allocations.reduce((sum, allocation) => sum + Number(allocation.available_qty || 0), 0),
  };
}

function getPoLineId(line: PurchaseOrderLine): number | null {
  const poLineId = Number(line.id);
  return Number.isFinite(poLineId) && poLineId > 0 ? poLineId : null;
}

function lineSortValue(line: PurchaseOrderLine, summary: PurchaseOrderPreorderLineSummary | undefined, key: LineSortKey): string | number {
  const allocation = summary?.allocations[0];
  const totals = lineTotals(summary);
  switch (key) {
    case "sku": return String(line.sku || "").toLocaleLowerCase();
    case "product_name": return String(line.product_name || "").toLocaleLowerCase();
    case "qty": return Number(line.qty || 0);
    case "stock_qty": return line.stock_qty === null || line.stock_qty === undefined
      ? Number.NEGATIVE_INFINITY
      : Number(line.stock_qty);
    case "days_of_cover": return line.days_of_cover === null || line.days_of_cover === undefined
      ? Number.NEGATIVE_INFINITY
      : Number(line.days_of_cover);
    case "needs_reorder": return line.reorder_within_lead_time === null || line.reorder_within_lead_time === undefined
      ? Number.NEGATIVE_INFINITY
      : line.reorder_within_lead_time ? 1 : 0;
    case "allocated": return totals.allocated;
    case "reserved": return totals.reserved;
    case "available": return totals.available;
    case "status": return allocation?.status || "not allocated";
    case "reserve": return allocation?.is_reserve_enabled ? 1 : 0;
    default: return "";
  }
}

function Row({ po, handleEdit, handleDelete, handleExportPdf, handleExportSheet, exportingKey }: {
  po: PurchaseOrder,
  handleEdit: (po: PurchaseOrder) => void,
  handleDelete: (id: number) => void,
  handleExportPdf: (po: PurchaseOrder) => void,
  handleExportSheet: (po: PurchaseOrder, audience: PurchaseOrderSheetAudience) => void,
  exportingKey: string | null,
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<PurchaseOrderPreorderSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [bulkAllocating, setBulkAllocating] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [lineFilter, setLineFilter] = useState("");
  const [lineSortKey, setLineSortKey] = useState<LineSortKey>("sku");
  const [lineSortDirection, setLineSortDirection] = useState<SortDirection>("asc");
  const [bulkReserveEnabled, setBulkReserveEnabled] = useState(true);
  const [bulkDepositType, setBulkDepositType] = useState<ReserveDepositType>("percent");
  const [bulkDepositValue, setBulkDepositValue] = useState("");
  const [bulkReserveUpdating, setBulkReserveUpdating] = useState(false);
  const [reserveUpdatingAllocationId, setReserveUpdatingAllocationId] = useState<number | null>(null);
  const [deletingAllocationId, setDeletingAllocationId] = useState<number | null>(null);
  const [receivePreview, setReceivePreview] = useState<PurchaseOrderReceiveStockResult | null>(null);
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveMessage, setReceiveMessage] = useState<string | null>(null);
  const [processPreordersOnReceipt, setProcessPreordersOnReceipt] = useState(true);
  const receiveBlockingErrors = receivePreview?.blocking_errors ?? [];
  const canBookReceiveStock = !!receivePreview && receiveBlockingErrors.length === 0;

  const loadSummary = useCallback(async () => {
    if (!po.id) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await preordersApi.getPurchaseOrderSummary(po.id));
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to load preorder allocation summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [po.id]);

  useEffect(() => {
    if (open) {
      loadSummary();
    }
  }, [loadSummary, open]);

  const handleBulkAllocate = async () => {
    if (!po.id) return;
    setSummaryError(null);
    setSummaryMessage(null);
    setBulkAllocating(true);
    try {
      const result = await preordersApi.bulkAllocatePurchaseOrder(po.id);
      setSummaryMessage(`Bulk allocation complete: ${result.created_count} created, ${result.updated_count} updated, ${result.skipped_count} skipped.`);
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to bulk allocate purchase order");
    } finally {
      setBulkAllocating(false);
    }
  };

  const handleAllocateLine = async (line: PurchaseOrderLine) => {
    const poLineId = getPoLineId(line);
    if (!poLineId) {
      setSummaryError("This PO line does not have a saved line ID yet.");
      return;
    }
    setSummaryError(null);
    try {
      await preordersApi.createAllocation({
        po_line_id: poLineId,
        allocated_qty: Number(line.qty || 0),
        status: "active"
      });
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to allocate PO line");
    }
  };

  const handleSetLineFullQty = async (line: PurchaseOrderLine, lineSummary?: PurchaseOrderPreorderLineSummary) => {
    const allocation = lineSummary?.allocations[0];
    if (!allocation) {
      await handleAllocateLine(line);
      return;
    }
    setSummaryError(null);
    try {
      await preordersApi.updateAllocation(allocation.id, {
        allocated_qty: Number(line.qty || 0),
        status: "active"
      });
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to update PO line allocation");
    }
  };

  const handleAllocationStatus = async (lineSummary: PurchaseOrderPreorderLineSummary, status: AllocationStatus) => {
    const allocation = lineSummary.allocations[0];
    if (!allocation) return;
    setSummaryError(null);
    try {
      await preordersApi.updateAllocation(allocation.id, { status });
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to update preorder allocation status");
    }
  };

  const handleReserveEnabled = async (line: PurchaseOrderLine, lineSummary: PurchaseOrderPreorderLineSummary | undefined, enabled: boolean) => {
    const allocation = lineSummary?.allocations[0];
    const poLineId = getPoLineId(line);
    if (!allocation && !poLineId) {
      setSummaryError("This PO line does not have a saved line ID yet.");
      return;
    }
    setSummaryError(null);
    setSummaryMessage(null);
    setReserveUpdatingAllocationId(allocation?.id ?? -Number(poLineId));
    try {
      const updated = allocation
        ? await preordersApi.updateAllocation(allocation.id, { is_reserve_enabled: enabled })
        : await preordersApi.createAllocation({
            po_line_id: Number(poLineId),
            allocated_qty: Math.max(0, Number(line.qty || 0)),
            status: "active",
            is_reserve_enabled: enabled
          });
      setSummaryMessage(
        `${enabled ? "Enabled" : "Disabled"} Reserve for ${updated.sku}` +
        `${enabled
          ? ` with a ${updated.reserve_deposit_type === "fixed"
            ? `$${qty(updated.reserve_deposit_fixed_amount)}`
            : `${qty(updated.reserve_deposit_percentage)}%`} deposit and uncapped draft demand.`
          : "."}`
      );
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to update Reserve availability");
    } finally {
      setReserveUpdatingAllocationId(null);
    }
  };

  const handleReserveDepositType = async (lineSummary: PurchaseOrderPreorderLineSummary, depositType: ReserveDepositType) => {
    const allocation = lineSummary.allocations[0];
    if (!allocation || allocation.reserve_deposit_type === depositType) return;
    setSummaryError(null);
    setSummaryMessage(null);
    setReserveUpdatingAllocationId(allocation.id);
    try {
      const updated = await preordersApi.updateAllocation(allocation.id, { reserve_deposit_type: depositType });
      setSummaryMessage(`Set the Reserve deposit type for ${updated.sku} to ${depositType === "fixed" ? "fixed amount" : "percentage"}.`);
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to update Reserve deposit type");
    } finally {
      setReserveUpdatingAllocationId(null);
    }
  };

  const handleReserveDepositValue = async (lineSummary: PurchaseOrderPreorderLineSummary, value: string) => {
    const allocation = lineSummary.allocations[0];
    const amount = Number(value);
    const isPercentage = allocation?.reserve_deposit_type !== "fixed";
    if (!allocation || !Number.isFinite(amount) || amount <= 0 || (isPercentage && amount >= 100)) {
      setSummaryError(isPercentage
        ? "Reserve deposit percentage must be greater than 0 and less than 100."
        : "Fixed Reserve deposit must be greater than $0 and less than the product price.");
      return;
    }
    const currentValue = isPercentage
      ? Number(allocation.reserve_deposit_percentage)
      : Number(allocation.reserve_deposit_fixed_amount);
    if (amount === currentValue) return;
    setSummaryError(null);
    setSummaryMessage(null);
    setReserveUpdatingAllocationId(allocation.id);
    try {
      const updated = await preordersApi.updateAllocation(
        allocation.id,
        isPercentage
          ? { reserve_deposit_percentage: amount }
          : { reserve_deposit_fixed_amount: amount }
      );
      setSummaryMessage(
        `Set the Reserve deposit for ${updated.sku} to ` +
        `${isPercentage ? `${qty(updated.reserve_deposit_percentage)}%` : `$${qty(updated.reserve_deposit_fixed_amount)}`}.`
      );
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to update Reserve deposit value");
    } finally {
      setReserveUpdatingAllocationId(null);
    }
  };

  const handleUnallocateLine = async (lineSummary: PurchaseOrderPreorderLineSummary) => {
    const allocation = lineSummary.allocations[0];
    if (!allocation) return;
    const confirmed = window.confirm(
      `Unallocate ${allocation.sku} from this purchase order? You can then remove the product from the PO.`
    );
    if (!confirmed) return;
    setSummaryError(null);
    setSummaryMessage(null);
    setDeletingAllocationId(allocation.id);
    try {
      await preordersApi.deleteAllocation(allocation.id);
      setSummaryMessage(`Unallocated ${allocation.sku}. The product can now be removed from the PO.`);
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to unallocate PO line");
    } finally {
      setDeletingAllocationId(null);
    }
  };

  const handlePreviewReceiveStock = async () => {
    if (!po.id) return;
    setReceiveLoading(true);
    setReceiveError(null);
    setReceiveMessage(null);
    try {
      setReceivePreview(await purchaseOrdersApi.receiveStock(po.id, { dry_run: true }));
    } catch (err) {
      setReceiveError(errorMessage(err, "Failed to preview received stock booking"));
    } finally {
      setReceiveLoading(false);
    }
  };

  const handleBookReceiveStock = async () => {
    if (!po.id) return;
    const confirmed = window.confirm(`Book received stock for this purchase order now? This will update WooCommerce stock${processPreordersOnReceipt ? " and process eligible PreOrder orders" : ""}.`);
    if (!confirmed) return;
    setReceiveLoading(true);
    setReceiveError(null);
    setReceiveMessage(null);
    try {
      const result = await purchaseOrdersApi.receiveStock(po.id, { dry_run: false, book_stock: true, process_preorders: processPreordersOnReceipt });
      setReceivePreview(result);
      setReceiveMessage(
        `Stock booked${result.receipt_id ? ` with receipt ${result.receipt_id}` : ""}. ` +
        `Processed ${result.processed_order_ids?.length ?? 0} preorder order(s) and issued ` +
        `${result.reserve_invoice_results?.balance_order_ids.length ?? 0} Reserve balance invoice(s).`
      );
      await loadSummary();
    } catch (err) {
      const errorPreview = receivePreviewFromError(err);
      if (errorPreview) {
        setReceivePreview(errorPreview);
      }
      setReceiveError(errorMessage(err, "Failed to book received stock"));
    } finally {
      setReceiveLoading(false);
    }
  };

  const visibleLineEntries = filterPurchaseOrderLines(po.lines || [], lineFilter).sort((left, right) => {
    const leftLineId = getPoLineId(left.line);
    const rightLineId = getPoLineId(right.line);
    const leftSummary = summary?.line_summaries.find((item) => Number(item.po_line_id) === leftLineId);
    const rightSummary = summary?.line_summaries.find((item) => Number(item.po_line_id) === rightLineId);
    const leftValue = lineSortValue(left.line, leftSummary, lineSortKey);
    const rightValue = lineSortValue(right.line, rightSummary, lineSortKey);
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return lineSortDirection === "asc" ? comparison : -comparison;
  });
  const visibleLineIds = visibleLineEntries
    .map(({ line }) => getPoLineId(line))
    .filter((lineId): lineId is number => lineId !== null);
  const allVisibleSelected = visibleLineIds.length > 0 && visibleLineIds.every((lineId) => selectedLineIds.includes(lineId));
  const someVisibleSelected = visibleLineIds.some((lineId) => selectedLineIds.includes(lineId)) && !allVisibleSelected;

  const handleLineSort = (key: LineSortKey) => {
    if (lineSortKey === key) {
      setLineSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    } else {
      setLineSortKey(key);
      setLineSortDirection("asc");
    }
  };

  const handleSelectAllVisible = (checked: boolean) => {
    setSelectedLineIds((current) => checked
      ? Array.from(new Set([...current, ...visibleLineIds]))
      : current.filter((lineId) => !visibleLineIds.includes(lineId))
    );
  };

  const handleBulkReserveUpdate = async () => {
    if (!po.id || selectedLineIds.length === 0) return;
    const depositValue = Number(bulkDepositValue);
    const appliesDeposit = bulkReserveEnabled && bulkDepositValue.trim() !== "";
    if (appliesDeposit && (!Number.isFinite(depositValue) || depositValue <= 0 || (bulkDepositType === "percent" && depositValue >= 100))) {
      setSummaryError(bulkDepositType === "percent"
        ? "Bulk Reserve percentage must be greater than 0 and less than 100."
        : "Bulk fixed Reserve deposit must be greater than $0.");
      return;
    }
    setSummaryError(null);
    setSummaryMessage(null);
    setBulkReserveUpdating(true);
    try {
      const result = await preordersApi.bulkUpdateReserveAllocations({
        po_id: po.id,
        po_line_ids: selectedLineIds,
        is_reserve_enabled: bulkReserveEnabled,
        ...(appliesDeposit ? {
          reserve_deposit_type: bulkDepositType,
          ...(bulkDepositType === "percent"
            ? { reserve_deposit_percentage: depositValue }
            : { reserve_deposit_fixed_amount: depositValue })
        } : {})
      });
      setSummaryMessage(`Updated Reserve settings for ${result.updated_count} selected line(s).`);
      await loadSummary();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to bulk update Reserve settings");
    } finally {
      setBulkReserveUpdating(false);
    }
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{po.po_number}</TableCell>
        <TableCell>{po.supplier_name || '-'}</TableCell>
        <TableCell>{po.preorder_campaign || '-'}</TableCell>
        <TableCell>
          <Chip size="small" label={po.status} color={po.status === 'ordered' ? 'primary' : po.status === 'shipped' ? 'info' : 'default'} />
        </TableCell>
        <TableCell>{new Date(po.created_date).toLocaleDateString()}</TableCell>
        <TableCell>{po.eta_date ? new Date(po.eta_date).toLocaleDateString() : '-'}</TableCell>
          <TableCell>{(po.shipping_type || 'sea').charAt(0).toUpperCase() + (po.shipping_type || 'sea').slice(1)}</TableCell>
        <TableCell>${parseFloat(po.total_cost_aud as any || 0).toFixed(2)}</TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
            <Tooltip title="Export PDF">
              <span>
                <Button
                  size="small"
                  onClick={() => handleExportPdf(po)}
                  disabled={!po.id || exportingKey === `pdf-${po.id}` || exportingKey === `sheet-${po.id}` || exportingKey === `supplier-sheet-${po.id}`}
                >
                  PDF
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Export internal Google Sheet">
              <span>
                <Button
                  size="small"
                  onClick={() => handleExportSheet(po, "internal")}
                  disabled={!po.id || exportingKey === `pdf-${po.id}` || exportingKey === `sheet-${po.id}` || exportingKey === `supplier-sheet-${po.id}`}
                >
                  Sheet
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Export supplier Google Sheet">
              <span>
                <Button
                  size="small"
                  onClick={() => handleExportSheet(po, "supplier")}
                  disabled={!po.id || exportingKey === `pdf-${po.id}` || exportingKey === `sheet-${po.id}` || exportingKey === `supplier-sheet-${po.id}`}
                >
                  Supplier sheet
                </Button>
              </span>
            </Tooltip>
            <IconButton onClick={() => handleEdit(po)} size="small" aria-label={`Edit ${po.po_number}`}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDelete(po.id!)} size="small" color="error" aria-label={`Delete ${po.po_number}`}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h6" component="div">Line Items</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reserve demand is uncapped while the PO is draft. Set each line quantity to at least its paid Reserve demand before submitting the PO.
                  </Typography>
                </Box>
                <Button size="small" variant="contained" onClick={handleBulkAllocate} disabled={!po.id || summaryLoading || bulkAllocating}>
                  {bulkAllocating ? "Allocating..." : "Bulk Allocate Full PO"}
                </Button>
                {po.status === "received" && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={processPreordersOnReceipt}
                          onChange={(event) => setProcessPreordersOnReceipt(event.target.checked)}
                          disabled={receiveLoading}
                        />
                      }
                      label="Move eligible PreOrder orders to Processing (Reserve balances are invoiced automatically)"
                    />
                    <Button size="small" variant="outlined" onClick={handlePreviewReceiveStock} disabled={!po.id || receiveLoading}>
                      Preview Stock Receipt
                    </Button>
                    <Button size="small" variant="contained" color="success" onClick={handleBookReceiveStock} disabled={!po.id || receiveLoading || !canBookReceiveStock}>
                      Book Received Stock
                    </Button>
                    {!receivePreview && (
                      <Typography variant="caption" color="text.secondary">
                        Run preview before booking.
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
              {summaryError && <Alert severity="error" sx={{ mb: 1 }}>{summaryError}</Alert>}
              {summaryMessage && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSummaryMessage(null)}>{summaryMessage}</Alert>}
              {receiveError && <Alert severity="error" sx={{ mb: 1 }}>{receiveError}</Alert>}
              {receiveMessage && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setReceiveMessage(null)}>{receiveMessage}</Alert>}
              {receivePreview && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Received Stock Preview</Typography>
                  {receiveBlockingErrors.length > 0 && (
                    <Alert severity="error" sx={{ my: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        Stock receipt is blocked until these line errors are resolved:
                      </Typography>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {receiveBlockingErrors.map((error, index) => (
                          <Typography key={`${error.po_line_id ?? "line"}-${index}`} variant="body2">
                            Line {error.po_line_id ?? "-"} / SKU {error.sku || "-"}: {error.error_code || "error"} - {error.message || "No detail returned."}
                          </Typography>
                        ))}
                      </Stack>
                    </Alert>
                  )}
                  {receivePreview.blocked_orders.length > 0 && <Alert severity="info" sx={{ my: 1 }}>{receivePreview.blocked_orders.length} preorder order(s) are not ready to process yet.</Alert>}
                  {(receivePreview.reserve_invoice_results?.errors.length ?? 0) > 0 && (
                    <Alert severity="error" sx={{ my: 1 }}>
                      {receivePreview.reserve_invoice_results!.errors.map((error) => (
                        <Typography key={`${error.order_id}-${error.error_code}`} variant="body2">
                          Reserve order {error.order_id}: {error.error_code} - {error.error_message}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell>Stock Target</TableCell>
                        <TableCell>WSVI Group</TableCell>
                        <TableCell align="right">Received</TableCell>
                        <TableCell align="right">Manual Hold</TableCell>
                        <TableCell align="right">Reserve Qty</TableCell>
                        <TableCell align="right">Stock Before</TableCell>
                        <TableCell align="right">Delta</TableCell>
                        <TableCell align="right">Expected After</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {receivePreview.lines.map((line) => (
                        <TableRow key={line.po_line_id}>
                          <TableCell>
                            {wooProductEditUrl(line.stock_target_product_id) ? (
                              <Link
                                href={wooProductEditUrl(line.stock_target_product_id) || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {line.sku}
                              </Link>
                            ) : line.sku}
                          </TableCell>
                          <TableCell>{line.stock_target_type || "-"}</TableCell>
                          <TableCell>{line.wsvi_group_name || line.wsvi_group_id || "-"}</TableCell>
                          <TableCell align="right">{qty(line.received_qty)}</TableCell>
                          <TableCell align="right">{qty(line.manual_hold_qty)}</TableCell>
                          <TableCell align="right">{qty(line.reserve_order_reserved_qty ?? 0)}</TableCell>
                          <TableCell align="right">{qty(line.stock_before)}</TableCell>
                          <TableCell align="right">{qty(line.stock_delta)}</TableCell>
                          <TableCell align="right">{qty(line.stock_after ?? line.expected_stock_after)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Eligible PreOrder orders: {receivePreview.eligible_orders.length}. Blocked PreOrder orders: {receivePreview.blocked_orders.length}. Reserve orders in this receipt: {receivePreview.reserve_orders?.length ?? 0}.
                  </Typography>
                </Box>
              )}
              {summaryLoading && <Typography variant="body2" sx={{ mb: 1 }}>Loading preorder allocations...</Typography>}
              <Stack direction={{ xs: "column", lg: "row" }} spacing={1} alignItems={{ lg: "center" }} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  label="Filter SKU or Product Name"
                  value={lineFilter}
                  onChange={(event) => setLineFilter(event.target.value)}
                  sx={{ minWidth: 280 }}
                />
                <TextField
                  select
                  size="small"
                  label="Reserve state"
                  value={bulkReserveEnabled ? "enable" : "disable"}
                  onChange={(event) => setBulkReserveEnabled(event.target.value === "enable")}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="enable">Enable Reserve</MenuItem>
                  <MenuItem value="disable">Disable Reserve</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Deposit type"
                  value={bulkDepositType}
                  onChange={(event) => setBulkDepositType(event.target.value as ReserveDepositType)}
                  disabled={!bulkReserveEnabled}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="percent">Percentage</MenuItem>
                  <MenuItem value="fixed">Fixed $</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label={bulkDepositType === "percent" ? "Deposit %" : "Deposit $"}
                  value={bulkDepositValue}
                  onChange={(event) => setBulkDepositValue(event.target.value)}
                  disabled={!bulkReserveEnabled}
                  placeholder="NY default"
                  slotProps={{ htmlInput: { min: 0.01, max: bulkDepositType === "percent" ? 99.99 : undefined, step: 0.01 } }}
                  sx={{ width: 120 }}
                />
                <Button
                  variant="contained"
                  onClick={handleBulkReserveUpdate}
                  disabled={bulkReserveUpdating || selectedLineIds.length === 0}
                >
                  {bulkReserveUpdating ? "Applying..." : `Apply to ${selectedLineIds.length} selected`}
                </Button>
              </Stack>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected}
                        onChange={(event) => handleSelectAllVisible(event.target.checked)}
                        inputProps={{ "aria-label": "Select all visible PO lines" }}
                      />
                    </TableCell>
                    <TableCell><TableSortLabel active={lineSortKey === "sku"} direction={lineSortKey === "sku" ? lineSortDirection : "asc"} onClick={() => handleLineSort("sku")}>SKU</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={lineSortKey === "product_name"} direction={lineSortKey === "product_name" ? lineSortDirection : "asc"} onClick={() => handleLineSort("product_name")}>Product Name</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "qty"} direction={lineSortKey === "qty" ? lineSortDirection : "asc"} onClick={() => handleLineSort("qty")}>Qty</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "stock_qty"} direction={lineSortKey === "stock_qty" ? lineSortDirection : "asc"} onClick={() => handleLineSort("stock_qty")}>Stock Qty</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "days_of_cover"} direction={lineSortKey === "days_of_cover" ? lineSortDirection : "asc"} onClick={() => handleLineSort("days_of_cover")}>Days of Cover</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={lineSortKey === "needs_reorder"} direction={lineSortKey === "needs_reorder" ? lineSortDirection : "asc"} onClick={() => handleLineSort("needs_reorder")}>Needs Reorder</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "allocated"} direction={lineSortKey === "allocated" ? lineSortDirection : "asc"} onClick={() => handleLineSort("allocated")}>Preorder Allocated</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "reserved"} direction={lineSortKey === "reserved" ? lineSortDirection : "asc"} onClick={() => handleLineSort("reserved")}>Reserved</TableSortLabel></TableCell>
                    <TableCell align="right"><TableSortLabel active={lineSortKey === "available"} direction={lineSortKey === "available" ? lineSortDirection : "asc"} onClick={() => handleLineSort("available")}>Available</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={lineSortKey === "status"} direction={lineSortKey === "status" ? lineSortDirection : "asc"} onClick={() => handleLineSort("status")}>Status</TableSortLabel></TableCell>
                    <TableCell><TableSortLabel active={lineSortKey === "reserve"} direction={lineSortKey === "reserve" ? lineSortDirection : "asc"} onClick={() => handleLineSort("reserve")}>Reserve</TableSortLabel></TableCell>
                    <TableCell align="right">Preorder Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleLineEntries.length > 0 ? visibleLineEntries.map(({ line, originalIndex: idx }) => {
                    const poLineId = getPoLineId(line);
                    const lineSummary = summary?.line_summaries.find((item) => Number(item.po_line_id) === poLineId);
                    const totals = lineTotals(lineSummary);
                    const allocation = lineSummary?.allocations[0];
                    return (
                      <TableRow key={poLineId ?? idx} selected={poLineId !== null && selectedLineIds.includes(poLineId)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={poLineId !== null && selectedLineIds.includes(poLineId)}
                            disabled={poLineId === null}
                            onChange={(event) => {
                              if (poLineId === null) return;
                              setSelectedLineIds((current) => event.target.checked
                                ? Array.from(new Set([...current, poLineId]))
                                : current.filter((lineId) => lineId !== poLineId)
                              );
                            }}
                            inputProps={{ "aria-label": `Select ${line.sku || line.product_name}` }}
                          />
                        </TableCell>
                        <TableCell component="th" scope="row">
                          {wooProductEditUrl(line.edit_product_id || line.parent_product_id || line.product_id) && line.sku ? (
                            <Link
                              href={wooProductEditUrl(line.edit_product_id || line.parent_product_id || line.product_id) || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {line.sku}
                            </Link>
                          ) : line.sku || "N/A"}
                        </TableCell>
                        <TableCell>{line.product_name}</TableCell>
                        <TableCell align="right">{qty(line.qty)}</TableCell>
                        <TableCell
                          align="right"
                          title={[
                            line.stock_target_type === "wsvi_group"
                              ? "Current pooled WSVI stock quantity"
                              : "Current stock quantity",
                            line.stock_snapshot_date
                              ? `snapshot ${line.stock_snapshot_date}`
                              : null,
                          ].filter(Boolean).join(" · ")}
                        >
                          {line.stock_qty === null || line.stock_qty === undefined
                            ? "—"
                            : qty(line.stock_qty)}
                        </TableCell>
                        <TableCell
                          align="right"
                          title={[
                            line.avg_daily_usage === null || line.avg_daily_usage === undefined
                              ? null
                              : `Average daily usage ${qty(line.avg_daily_usage)}`,
                            line.forecast_window_days
                              ? `${line.forecast_window_days}-day observed window`
                              : null,
                            line.forecast_source || null,
                          ].filter(Boolean).join(" · ")}
                        >
                          {line.days_of_cover === null || line.days_of_cover === undefined
                            ? "—"
                            : Number(line.days_of_cover).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell
                          title={line.effective_lead_time_days
                            ? `Compared with ${line.effective_lead_time_days}-day effective lead time`
                            : undefined}
                        >
                          {line.reorder_within_lead_time === null || line.reorder_within_lead_time === undefined
                            ? "—"
                            : (
                              <Chip
                                size="small"
                                label={line.reorder_within_lead_time ? "Yes" : "No"}
                                color={line.reorder_within_lead_time ? "warning" : "default"}
                              />
                            )}
                        </TableCell>
                        <TableCell align="right">{qty(totals.allocated)}</TableCell>
                        <TableCell align="right">{qty(totals.reserved)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={allocation?.is_reserve_uncapped ? "Uncapped" : qty(totals.available)}
                            color={allocation?.is_reserve_uncapped || totals.available > 0 ? "success" : "default"}
                          />
                        </TableCell>
                        <TableCell>
                          {allocation ? (
                            <TextField
                              select
                              size="small"
                              value={allocation.status}
                              onChange={(event) => lineSummary && handleAllocationStatus(lineSummary, event.target.value as AllocationStatus)}
                              sx={{ minWidth: 130 }}
                            >
                              {allocationStatuses.map((status) => (
                                <MenuItem key={status} value={status}>{status}</MenuItem>
                              ))}
                            </TextField>
                          ) : (
                            <Chip size="small" label="not allocated" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={Boolean(allocation?.is_reserve_enabled)}
                                  disabled={
                                    !poLineId ||
                                    reserveUpdatingAllocationId === (allocation?.id ?? -Number(poLineId)) ||
                                    (po.status !== "draft" && !allocation?.is_reserve_enabled)
                                  }
                                  onChange={(event) => handleReserveEnabled(line, lineSummary, event.target.checked)}
                                />
                              }
                              label="Reserve"
                            />
                            {allocation ? (
                              <>
                                <TextField
                                  select
                                  size="small"
                                  value={allocation.reserve_deposit_type || "percent"}
                                  onChange={(event) => lineSummary && handleReserveDepositType(lineSummary, event.target.value as ReserveDepositType)}
                                  disabled={reserveUpdatingAllocationId === allocation.id}
                                  sx={{ minWidth: 105 }}
                                  label="Type"
                                >
                                  <MenuItem value="percent">Percent</MenuItem>
                                  <MenuItem value="fixed">Fixed $</MenuItem>
                                </TextField>
                                <TextField
                                  key={`${allocation.id}-${allocation.reserve_deposit_type}-${allocation.reserve_deposit_percentage}-${allocation.reserve_deposit_fixed_amount}`}
                                  type="number"
                                  size="small"
                                  defaultValue={allocation.reserve_deposit_type === "fixed"
                                    ? allocation.reserve_deposit_fixed_amount
                                    : allocation.reserve_deposit_percentage}
                                  onBlur={(event) => lineSummary && handleReserveDepositValue(lineSummary, event.target.value)}
                                  disabled={reserveUpdatingAllocationId === allocation.id}
                                  slotProps={{ htmlInput: {
                                    min: 0.01,
                                    max: allocation.reserve_deposit_type === "fixed" ? undefined : 99.99,
                                    step: 0.01
                                  } }}
                                  sx={{ width: 92 }}
                                  label={allocation.reserve_deposit_type === "fixed" ? "Deposit $" : "Deposit %"}
                                />
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">NY default</Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => handleSetLineFullQty(line, lineSummary)} disabled={!poLineId || Number(line.qty || 0) <= 0}>
                              {allocation ? "Set Full Qty" : "Allocate Line"}
                            </Button>
                            {allocation && lineSummary && (
                              <Button
                                size="small"
                                color="error"
                                onClick={() => handleUnallocateLine(lineSummary)}
                                disabled={
                                  deletingAllocationId === allocation.id ||
                                  Number(allocation.reserved_qty || 0) > 0 ||
                                  Number(allocation.consumed_qty || 0) > 0
                                }
                              >
                                {deletingAllocationId === allocation.id ? "Unallocating..." : "Unallocate"}
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={13}>No matching line items found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function PurchaseOrdersPage() {
  const { data, loading, error, refetch, updatePurchaseOrder, upsertPurchaseOrder } = usePurchaseOrders();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string; href?: string; linkLabel?: string } | null>(null);
  const [sheetPrompt, setSheetPrompt] = useState<{ po: PurchaseOrder; audience: PurchaseOrderSheetAudience } | null>(null);
  const [pdfPrompt, setPdfPrompt] = useState<PurchaseOrder | null>(null);

  const createPdf = async (po: PurchaseOrder) => {
    if (!po.id) return;
    const pdfTab = openCreatingSheetTab("Creating the purchase order PDF…");
    if (!pdfTab) {
      setExportMessage({ type: "error", text: "The browser blocked the PDF tab. Allow pop-ups for this site, then try again." });
      return;
    }
    setExportingKey(`pdf-${po.id}`);
    setExportMessage(null);
    try {
      const result = await purchaseOrdersApi.exportPdf(po.id);
      pdfTab.reveal(result.pdf_url);
      updatePurchaseOrder(po.id, { pdf_link: result.pdf_link, drive_link: result.drive_link });
      setExportMessage({
        type: "success",
        text: `${po.po_number}: ${purchaseOrderPdfExportMessage(result)}`,
        href: result.pdf_url,
        linkLabel: "Open PDF",
      });
    } catch (err) {
      const pdfUrl = exportUrlFromError(err, "pdf_url");
      const message = err instanceof Error ? err.message : "Failed to export the purchase order PDF.";
      if (pdfUrl) {
        pdfTab.reveal(pdfUrl);
      } else {
        pdfTab.fail(message);
      }
      setExportMessage({ type: "error", text: message, href: pdfUrl || undefined, linkLabel: "Open PDF" });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportPdf = (po: PurchaseOrder) => {
    if (!po.id) return;
    if ((po.pdf_link || "").trim()) {
      setPdfPrompt(po);
      return;
    }
    void createPdf(po);
  };

  const createSheet = async (po: PurchaseOrder, audience: PurchaseOrderSheetAudience) => {
    if (!po.id) return;
    const sheetTab = openCreatingSheetTab();
    if (!sheetTab) {
      setExportMessage({ type: "error", text: "The browser blocked the sheet tab. Allow pop-ups for this site, then try again." });
      return;
    }
    setExportingKey(audience === "supplier" ? `supplier-sheet-${po.id}` : `sheet-${po.id}`);
    setExportMessage(null);
    try {
      const result = await purchaseOrdersApi.exportSheet(po.id, audience);
      sheetTab.reveal(result.spreadsheet_url);
      updatePurchaseOrder(po.id, purchaseOrderSheetLinkPatch(audience, result));
      setExportMessage({
        type: "success",
        text: `${po.po_number}: ${purchaseOrderSheetExportMessage(result, audience)}`,
        href: result.spreadsheet_url,
        linkLabel: "Open sheet",
      });
    } catch (err) {
      const sheetUrl = exportUrlFromError(err, "spreadsheet_url");
      const message = err instanceof Error ? err.message : "Failed to export the purchase order Google Sheet.";
      if (sheetUrl) {
        sheetTab.reveal(sheetUrl);
      } else {
        sheetTab.fail(message);
      }
      setExportMessage({ type: "error", text: message, href: sheetUrl || undefined, linkLabel: "Open sheet" });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportSheet = (po: PurchaseOrder, audience: PurchaseOrderSheetAudience) => {
    if (!po.id) return;
    if (existingPurchaseOrderSheetLink(po, audience)) {
      setSheetPrompt({ po, audience });
      return;
    }
    void createSheet(po, audience);
  };

  const handleOpenSavedSheet = () => {
    if (!sheetPrompt) return;
    const url = existingPurchaseOrderSheetLink(sheetPrompt.po, sheetPrompt.audience);
    setSheetPrompt(null);
    if (!url || !openSavedSheet(url)) {
      setExportMessage({ type: "error", text: "The browser blocked the sheet tab. Allow pop-ups for this site, then try again.", href: url || undefined });
    }
  };

  const handleCreateSheetVersion = () => {
    if (!sheetPrompt) return;
    const prompt = sheetPrompt;
    setSheetPrompt(null);
    void createSheet(prompt.po, prompt.audience);
  };

  const handleCreate = () => {
    setSelectedPo(null);
    setModalOpen(true);
  };

  const handleEdit = async (po: PurchaseOrder) => {
    try {
      const fullPo = await purchaseOrdersApi.get(po.id!);
      setSelectedPo(fullPo);
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to load purchase order details");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this purchase order?")) {
      try {
        await purchaseOrdersApi.delete(id);
        refetch();
      } catch (err) {
        console.error(err);
        alert("Failed to delete purchase order");
      }
    }
  };

  const handleModalClose = (saved: boolean) => {
    setModalOpen(false);
    if (saved) {
      refetch();
    }
  };

  const handlePurchaseOrderApplied = (order: PurchaseOrder) => {
    setSelectedPo(order);
    upsertPurchaseOrder(order);
  };

  if (loading) return <LoadStateBlock isLoading={true} error={null} empty={false} />;
  if (error) return <LoadStateBlock isLoading={false} error={error} empty={false} />;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Purchase Orders</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Create PO
        </Button>
      </Box>
      {exportMessage ? (
        <Alert severity={exportMessage.type} onClose={() => setExportMessage(null)}>
          {exportMessage.text}
          {exportMessage.href ? (
            <>
              {" "}
              <Link href={exportMessage.href} target="_blank" rel="noopener noreferrer">{exportMessage.linkLabel || "Open"}</Link>
            </>
          ) : null}
        </Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>PO Number</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Pre-order Shipment</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>ETA Date</TableCell>
              <TableCell>Shipping Type</TableCell>
              <TableCell>Total Cost (AUD)</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((po) => (
              <Row
                key={po.id}
                po={po}
                handleEdit={handleEdit}
                handleDelete={handleDelete}
                handleExportPdf={handleExportPdf}
                handleExportSheet={handleExportSheet}
                exportingKey={exportingKey}
              />
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">No purchase orders found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(pdfPrompt)} onClose={() => setPdfPrompt(null)}>
        <DialogTitle>PDF already exists</DialogTitle>
        <DialogContent>
          <Typography>
            {pdfPrompt ? `${pdfPrompt.po_number} already has a PDF. Open the existing PDF, or replace it in its Drive folder.` : ""}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPdfPrompt(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!pdfPrompt) return;
            const url = (pdfPrompt.pdf_link || "").trim();
            setPdfPrompt(null);
            if (!url || !openSavedSheet(url)) {
              setExportMessage({ type: "error", text: "The browser blocked the PDF tab. Allow pop-ups for this site, then try again.", href: url || undefined, linkLabel: "Open PDF" });
            }
          }}>Open existing</Button>
          <Button variant="contained" onClick={() => {
            if (!pdfPrompt) return;
            const prompt = pdfPrompt;
            setPdfPrompt(null);
            void createPdf(prompt);
          }}>Replace</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(sheetPrompt)} onClose={() => setSheetPrompt(null)}>
        <DialogTitle>
          {sheetPrompt?.audience === "supplier" ? "Supplier Google Sheet already exists" : "Google Sheet already exists"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {sheetPrompt ? `${sheetPrompt.po.po_number} already has this Google Sheet. Open the existing sheet, or create a new version in its Drive folder.` : ""}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSheetPrompt(null)}>Cancel</Button>
          <Button onClick={handleOpenSavedSheet}>Open existing</Button>
          <Button variant="contained" onClick={handleCreateSheetVersion}>Create new version</Button>
        </DialogActions>
      </Dialog>

      {modalOpen && (
        <PurchaseOrderModal
          open={modalOpen}
          onClose={handleModalClose}
          onApplied={handlePurchaseOrderApplied}
          po={selectedPo}
        />
      )}
    </Stack>
  );
}

export default PurchaseOrdersPage;
