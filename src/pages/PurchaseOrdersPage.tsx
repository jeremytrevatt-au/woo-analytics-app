import { useCallback, useEffect, useState } from "react";
import { Alert, Stack, Typography, Button, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Collapse, TextField, MenuItem } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { purchaseOrdersApi, PurchaseOrder, PurchaseOrderLine, PurchaseOrderReceiveStockResult } from "../api/purchaseOrdersApi";
import { AllocationStatus, preordersApi, PurchaseOrderPreorderLineSummary, PurchaseOrderPreorderSummary } from "../api/preordersApi";
import LoadStateBlock from "../components/LoadStateBlock";
import PurchaseOrderModal from "../components/PurchaseOrderModal";

const allocationStatuses: AllocationStatus[] = ["active", "paused", "closed", "cancelled"];

function qty(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
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

function Row({ po, handleEdit, handleDelete }: { po: PurchaseOrder, handleEdit: (po: PurchaseOrder) => void, handleDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<PurchaseOrderPreorderSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [bulkAllocating, setBulkAllocating] = useState(false);
  const [receivePreview, setReceivePreview] = useState<PurchaseOrderReceiveStockResult | null>(null);
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveMessage, setReceiveMessage] = useState<string | null>(null);

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

  const handlePreviewReceiveStock = async () => {
    if (!po.id) return;
    setReceiveLoading(true);
    setReceiveError(null);
    setReceiveMessage(null);
    try {
      setReceivePreview(await purchaseOrdersApi.receiveStock(po.id, { dry_run: true }));
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Failed to preview received stock booking");
    } finally {
      setReceiveLoading(false);
    }
  };

  const handleBookReceiveStock = async () => {
    if (!po.id) return;
    const confirmed = window.confirm("Book received stock for this purchase order now? This will update WooCommerce stock and process eligible PreOrder orders.");
    if (!confirmed) return;
    setReceiveLoading(true);
    setReceiveError(null);
    setReceiveMessage(null);
    try {
      const result = await purchaseOrdersApi.receiveStock(po.id, { dry_run: false, book_stock: true, process_preorders: true });
      setReceivePreview(result);
      setReceiveMessage(`Stock booked${result.receipt_id ? ` with receipt ${result.receipt_id}` : ""}. Processed ${result.processed_order_ids?.length ?? 0} preorder order(s).`);
      await loadSummary();
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Failed to book received stock");
    } finally {
      setReceiveLoading(false);
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
        <TableCell>
          <Chip size="small" label={po.status} color={po.status === 'ordered' ? 'primary' : po.status === 'shipped' ? 'info' : 'default'} />
        </TableCell>
        <TableCell>{new Date(po.created_date).toLocaleDateString()}</TableCell>
        <TableCell>{po.eta_date ? new Date(po.eta_date).toLocaleDateString() : '-'}</TableCell>
          <TableCell>{(po.shipping_type || 'sea').charAt(0).toUpperCase() + (po.shipping_type || 'sea').slice(1)}</TableCell>
        <TableCell>${parseFloat(po.total_cost_aud as any || 0).toFixed(2)}</TableCell>
        <TableCell align="right">
          <IconButton onClick={() => handleEdit(po)} size="small">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(po.id!)} size="small" color="error">
            <DeleteIcon />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h6" component="div">Line Items</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Preorder allocation is managed directly from the purchase order lines.
                  </Typography>
                </Box>
                <Button size="small" variant="contained" onClick={handleBulkAllocate} disabled={!po.id || summaryLoading || bulkAllocating}>
                  {bulkAllocating ? "Allocating..." : "Bulk Allocate Full PO"}
                </Button>
                {po.status === "received" && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={handlePreviewReceiveStock} disabled={!po.id || receiveLoading}>
                      Preview Stock Receipt
                    </Button>
                    <Button size="small" variant="contained" color="success" onClick={handleBookReceiveStock} disabled={!po.id || receiveLoading}>
                      Book Received Stock
                    </Button>
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
                  {receivePreview.blocking_errors.length > 0 && <Alert severity="warning" sx={{ my: 1 }}>There are blocking line errors. Review the preview before booking.</Alert>}
                  {receivePreview.blocked_orders.length > 0 && <Alert severity="info" sx={{ my: 1 }}>{receivePreview.blocked_orders.length} preorder order(s) are not ready to process yet.</Alert>}
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Received</TableCell>
                        <TableCell align="right">Manual Hold</TableCell>
                        <TableCell align="right">Stock Before</TableCell>
                        <TableCell align="right">Delta</TableCell>
                        <TableCell align="right">Expected After</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {receivePreview.lines.map((line) => (
                        <TableRow key={line.po_line_id}>
                          <TableCell>{line.sku}</TableCell>
                          <TableCell align="right">{qty(line.received_qty)}</TableCell>
                          <TableCell align="right">{qty(line.manual_hold_qty)}</TableCell>
                          <TableCell align="right">{qty(line.stock_before)}</TableCell>
                          <TableCell align="right">{qty(line.stock_delta)}</TableCell>
                          <TableCell align="right">{qty(line.stock_after ?? line.expected_stock_after)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Eligible PreOrder orders: {receivePreview.eligible_orders.length}. Blocked PreOrder orders: {receivePreview.blocked_orders.length}.
                  </Typography>
                </Box>
              )}
              {summaryLoading && <Typography variant="body2" sx={{ mb: 1 }}>Loading preorder allocations...</Typography>}
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Product Name</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Preorder Allocated</TableCell>
                    <TableCell align="right">Reserved</TableCell>
                    <TableCell align="right">Available</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Preorder Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {po.lines && po.lines.length > 0 ? po.lines.map((line, idx) => {
                    const poLineId = getPoLineId(line);
                    const lineSummary = summary?.line_summaries.find((item) => Number(item.po_line_id) === poLineId);
                    const totals = lineTotals(lineSummary);
                    const allocation = lineSummary?.allocations[0];
                    return (
                      <TableRow key={idx}>
                        <TableCell component="th" scope="row">
                          {line.sku || "N/A"}
                        </TableCell>
                        <TableCell>{line.product_name}</TableCell>
                        <TableCell align="right">{qty(line.qty)}</TableCell>
                        <TableCell align="right">{qty(totals.allocated)}</TableCell>
                        <TableCell align="right">{qty(totals.reserved)}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" label={qty(totals.available)} color={totals.available > 0 ? "success" : "default"} />
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
                        <TableCell align="right">
                          <Button size="small" onClick={() => handleSetLineFullQty(line, lineSummary)} disabled={!poLineId || Number(line.qty || 0) <= 0}>
                            {allocation ? "Set Full Qty" : "Allocate Line"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={8}>No line items found.</TableCell>
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
  const { data, loading, error, refetch } = usePurchaseOrders();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>PO Number</TableCell>
              <TableCell>Supplier</TableCell>
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
              <Row key={po.id} po={po} handleEdit={handleEdit} handleDelete={handleDelete} />
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">No purchase orders found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {modalOpen && (
        <PurchaseOrderModal
          open={modalOpen}
          onClose={handleModalClose}
          po={selectedPo}
        />
      )}
    </Stack>
  );
}

export default PurchaseOrdersPage;
