import { Fragment, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
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
  createReturn,
  createShippitReturnOrder,
  generateShippitReturnLabel,
  getShippitReturnOrder,
  getReturnableOrderItems,
  listReturns,
  previewShippitReturnQuote,
  probeShippitReturnsEndpoints,
  ReturnableOrderResponse,
  ReturnCase,
  ReturnStatus,
  ShippitReturnOrderResponse,
  ShippitReturnsProbeResult,
  ShippitReturnsProbeResponse,
  updateReturn,
} from "../api/returnsApi";
import { ApiRequestError } from "../api/httpClient";
import { wordpressAdminUrl } from "../config/wordpress";

const RETURN_STATUS_OPTIONS: Array<{ value: ReturnStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In Transit" },
  { value: "received", label: "Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

type QuoteRow = {
  courierType: string;
  serviceLevel: string;
  price: number;
  estimatedTransitTime: string;
};

function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [refundExpected, setRefundExpected] = useState(false);
  const [notes, setNotes] = useState("");
  const [returnableOrder, setReturnableOrder] = useState<ReturnableOrderResponse | null>(null);
  const [activeReturnCase, setActiveReturnCase] = useState<ReturnCase | null>(null);
  const [returnLineQty, setReturnLineQty] = useState<Record<number, string>>({});
  const [loadingReturnableItems, setLoadingReturnableItems] = useState(false);
  const [probeTrackingNumber, setProbeTrackingNumber] = useState("");
  const [probeResult, setProbeResult] = useState<ShippitReturnsProbeResponse | null>(null);
  const [probingShippit, setProbingShippit] = useState(false);
  const [quotePreview, setQuotePreview] = useState<ShippitReturnsProbeResult | null>(null);
  const [previewingQuote, setPreviewingQuote] = useState(false);
  const [shippitReturn, setShippitReturn] = useState<ShippitReturnOrderResponse | null>(null);
  const [creatingShippitReturn, setCreatingShippitReturn] = useState(false);
  const [pollingShippitReturn, setPollingShippitReturn] = useState(false);
  const [confirmingLabel, setConfirmingLabel] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const [expandedReturnId, setExpandedReturnId] = useState<number | null>(null);

  const loadReturns = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await listReturns({ status: statusFilter });
      setReturns(response);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to load return cases." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [statusFilter]);

  const handleCreate = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const selectedLines = returnableOrder?.items
        .map(item => ({
          order_item_id: item.order_item_id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          sku: item.sku,
          product_name: item.product_name,
          qty: Number(returnLineQty[item.order_item_id] || 0),
        }))
        .filter(line => Number.isFinite(line.qty) && line.qty > 0) ?? [];
      if (selectedLines.length === 0) {
        setMessage({ type: "error", text: "Enter at least one return quantity before saving the return case." });
        return;
      }

      const created = await createReturn({
        order_id: numericOrderId,
        reason,
        resolution,
        refund_expected: refundExpected,
        notes,
        lines: selectedLines,
      });
      setActiveReturnCase(created);
      setMessage({ type: "success", text: `Return case #${created.id} saved. It is now the authoritative record for Shippit creation.` });
      await loadReturns();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create return case." });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadReturnableItems = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }

    setLoadingReturnableItems(true);
    setMessage(null);
    try {
      const response = await getReturnableOrderItems(numericOrderId);
      setReturnableOrder(response);
      const initialQty: Record<number, string> = {};
      response.items.forEach(item => {
        initialQty[item.order_item_id] = "";
      });
      setReturnLineQty(initialQty);
      setMessage({ type: "success", text: `Loaded ${response.items.length} returnable item rows for order #${response.order.number}.` });
    } catch (error: any) {
      setReturnableOrder(null);
      setReturnLineQty({});
      setMessage({ type: "error", text: error.message || "Failed to load returnable order items." });
    } finally {
      setLoadingReturnableItems(false);
    }
  };

  const handleProbeShippit = async () => {
    setProbingShippit(true);
    setMessage(null);
    try {
      const numericOrderId = Number(orderId);
      const response = await probeShippitReturnsEndpoints({
        orderId: Number.isInteger(numericOrderId) && numericOrderId > 0 ? numericOrderId : undefined,
        trackingNumber: probeTrackingNumber.trim() || undefined,
      });
      setProbeResult(response);
      setMessage({ type: "success", text: "Shippit returns endpoint probe completed." });
    } catch (error: any) {
      setProbeResult(null);
      setMessage({ type: "error", text: error.message || "Failed to probe Shippit returns endpoints." });
    } finally {
      setProbingShippit(false);
    }
  };

  const selectedReturnLines = () => {
    return returnableOrder?.items
      .map(item => ({
        order_item_id: item.order_item_id,
        qty: Math.floor(Number(returnLineQty[item.order_item_id] || 0)),
      }))
      .filter(line => Number.isInteger(line.qty) && line.qty > 0) ?? [];
  };

  const handleSelectAllReturnableQty = () => {
    if (!returnableOrder) {
      return;
    }

    const allQty: Record<number, string> = {};
    returnableOrder.items.forEach(item => {
      allQty[item.order_item_id] = String(Math.floor(item.returnable_qty));
    });
    setReturnLineQty(allQty);
  };

  const handleClearReturnQty = () => {
    if (!returnableOrder) {
      return;
    }

    const emptyQty: Record<number, string> = {};
    returnableOrder.items.forEach(item => {
      emptyQty[item.order_item_id] = "";
    });
    setReturnLineQty(emptyQty);
  };

  const handleCreateShippitReturn = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }

    if (!activeReturnCase) {
      setMessage({ type: "error", text: "Save the return case before creating its Shippit return." });
      return;
    }
    if (!selectedQuote) {
      setMessage({ type: "error", text: "Preview and select a Shippit quote before creating the return shipment." });
      return;
    }

    setCreatingShippitReturn(true);
    setMessage(null);
    try {
      const response = await createShippitReturnOrder({
        orderId: numericOrderId,
        returnId: activeReturnCase.id,
        operationId: crypto.randomUUID(),
        courierType: selectedQuote.courierType,
        quotedCost: selectedQuote.price,
        currency: returnableOrder!.order.currency,
      });
      setShippitReturn(response);
      const returnId = response.return.return_order_id;
      const labelReady = Boolean(response.return.label_url);
      setMessage({
        type: "success",
        text: labelReady
          ? `Shippit return ${returnId} created and label is ready.`
          : `Shippit return ${returnId} created. Refresh status, or explicitly approve it to generate the label.`,
      });
    } catch (error: any) {
      setShippitReturn(null);
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to create Shippit return.") });
    } finally {
      setCreatingShippitReturn(false);
    }
  };

  const handlePollShippitReturn = async () => {
    const numericOrderId = Number(orderId);
    const returnOrderId = shippitReturn?.return.return_order_id;
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0 || !returnOrderId) {
      setMessage({ type: "error", text: "Create a Shippit return before refreshing its status." });
      return;
    }

    setPollingShippitReturn(true);
    setMessage(null);
    try {
      const response = await getShippitReturnOrder(numericOrderId, returnOrderId);
      setShippitReturn(response);
      setMessage({
        type: "success",
        text: response.return.label_url
          ? "Shippit return status refreshed; its label is ready."
          : "Shippit return status refreshed without approving or generating a label.",
      });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to poll Shippit return.") });
    } finally {
      setPollingShippitReturn(false);
    }
  };

  const handleGenerateLabel = async () => {
    const numericOrderId = Number(orderId);
    const returnOrderId = shippitReturn?.return.return_order_id;
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0 || !returnOrderId) {
      setMessage({ type: "error", text: "Create a Shippit return before generating its label." });
      return;
    }

    setGeneratingLabel(true);
    setMessage(null);
    try {
      const response = await generateShippitReturnLabel(numericOrderId, returnOrderId);
      setShippitReturn(response);
      setConfirmingLabel(false);
      setMessage({ type: "success", text: "Return approved in Shippit and label generated." });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to approve the return and generate its label.") });
    } finally {
      setGeneratingLabel(false);
    }
  };

  const handlePreviewQuote = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }

    setPreviewingQuote(true);
    setMessage(null);
    try {
      const response = await previewShippitReturnQuote({
        orderId: numericOrderId,
        lines: selectedReturnLines(),
      });
      setQuotePreview(response);
      setSelectedQuote(null);
      setMessage({ type: "success", text: "Return quote preview loaded." });
    } catch (error: any) {
      setQuotePreview(null);
      setMessage({ type: "error", text: error.message || "Failed to preview return quote." });
    } finally {
      setPreviewingQuote(false);
    }
  };

  const handleStatusChange = async (returnCase: ReturnCase, status: ReturnStatus) => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateReturn(returnCase.id, { status });
      setReturns(prev => prev.map(item => item.id === updated.id ? updated : item));
      setMessage({ type: "success", text: `Return #${updated.id} updated.` });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update return case." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Returns
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Analytics-owned return cases track return workflow separately from WooCommerce refund status and Shippit shipment handling.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Create Return Case
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="WooCommerce Order ID"
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setReturnableOrder(null);
                setReturnLineQty({});
                setActiveReturnCase(null);
                setShippitReturn(null);
                setQuotePreview(null);
                setSelectedQuote(null);
              }}
              type="number"
              inputProps={{ min: 1 }}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <TextField
              label="Resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              sx={{ minWidth: 260 }}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" onClick={handleLoadReturnableItems} disabled={loadingReturnableItems || saving}>
              {loadingReturnableItems ? "Loading Items..." : "Load Returnable Items"}
            </Button>
            <Button variant="outlined" onClick={handleSelectAllReturnableQty} disabled={!returnableOrder || saving || Boolean(activeReturnCase)}>
              Select All Returnable Qty
            </Button>
            <Button variant="outlined" onClick={handleClearReturnQty} disabled={!returnableOrder || saving || Boolean(activeReturnCase)}>
              Clear Qty
            </Button>
            <Button variant="outlined" onClick={handlePreviewQuote} disabled={previewingQuote || saving}>
              {previewingQuote ? "Loading Quote..." : "Preview Return Quote"}
            </Button>
            <Button variant="contained" color="secondary" onClick={handleCreateShippitReturn} disabled={creatingShippitReturn || saving || !activeReturnCase || !selectedQuote}>
              {creatingShippitReturn ? "Creating Shippit Return..." : "Create Shippit Return"}
            </Button>
            {returnableOrder ? (
              <Typography variant="body2" color="text.secondary">
                Order #{returnableOrder.order.number}: {returnableOrder.items.length} physical item rows
              </Typography>
            ) : null}
          </Stack>
          {returnableOrder ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Already Return/Refund</TableCell>
                  <TableCell align="right">Returnable</TableCell>
                  <TableCell align="right">Return Qty</TableCell>
                  <TableCell>Parcel Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnableOrder.items.map(item => (
                  <TableRow key={item.order_item_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{item.sku || "-"}</TableCell>
                    <TableCell align="right">{item.ordered_qty}</TableCell>
                    <TableCell align="right">{item.existing_return_qty + item.refunded_qty}</TableCell>
                    <TableCell align="right">{item.returnable_qty}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={returnLineQty[item.order_item_id] ?? ""}
                        onChange={(event) => setReturnLineQty(prev => ({ ...prev, [item.order_item_id]: event.target.value }))}
                        disabled={Boolean(activeReturnCase)}
                        inputProps={{ min: 0, max: item.returnable_qty, step: 1 }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                    <TableCell>
                      {item.weight_g}g, {item.length_cm} x {item.width_cm} x {item.height_cm}cm
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          {quotePreview ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Quote Preview
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Courier</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Transit</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extractQuoteRows(quotePreview).map((quote, index) => (
                    <TableRow key={`${quote.courierType}-${quote.serviceLevel}-${index}`}>
                      <TableCell>{quote.courierType}</TableCell>
                      <TableCell>{quote.serviceLevel}</TableCell>
                      <TableCell align="right">${quote.price.toFixed(2)}</TableCell>
                      <TableCell>{quote.estimatedTransitTime || "-"}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant={selectedQuote && quoteKey(selectedQuote) === quoteKey(quote) ? "contained" : "outlined"}
                          onClick={() => setSelectedQuote(quote)}
                        >
                          {selectedQuote && quoteKey(selectedQuote) === quoteKey(quote) ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {extractQuoteRows(quotePreview).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No successful quote rows returned.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Box>
          ) : null}
          {shippitReturn ? (
            <Alert severity={shippitReturn.return.label_url ? "success" : "info"}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">
                  Shippit Return {shippitReturn.return.return_order_id}
                </Typography>
                <Typography variant="body2">
                  Tracking: {shippitReturn.return.tracking_number || "-"}; State: {shippitReturn.return.state || "-"}; Label: {shippitReturn.return.label_url ? "Ready" : "Not ready"}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button size="small" variant="outlined" onClick={handlePollShippitReturn} disabled={pollingShippitReturn}>
                    {pollingShippitReturn ? "Refreshing..." : "Refresh Status"}
                  </Button>
                  {!shippitReturn.return.label_url ? (
                    <Button size="small" variant="contained" color="secondary" onClick={() => setConfirmingLabel(true)}>
                      Approve Return and Generate Label
                    </Button>
                  ) : null}
                  {shippitReturn.return.label_url ? (
                    <Button size="small" variant="contained" href={shippitReturn.return.label_url} target="_blank" rel="noopener noreferrer">
                      Open Return Label
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Alert>
          ) : null}
          <TextField
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={<Checkbox checked={refundExpected} onChange={(event) => setRefundExpected(event.target.checked)} />}
              label="Refund may be required"
            />
            <Button variant="outlined" onClick={handleCreate} disabled={saving || !returnableOrder || Boolean(activeReturnCase)}>
              {activeReturnCase ? `Return Case #${activeReturnCase.id} Saved` : "Save Return Case"}
            </Button>
            {activeReturnCase ? (
              <Button
                variant="text"
                onClick={() => {
                  setActiveReturnCase(null);
                  setShippitReturn(null);
                  setReturnableOrder(null);
                  setReturnLineQty({});
                  setQuotePreview(null);
                  setSelectedQuote(null);
                  setMessage({ type: "success", text: "Ready to start another return." });
                }}
              >
                Start Another Return
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Shippit Returns Diagnostics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Probes Shippit returns endpoints from the WordPress Shippit extension. Enter a WooCommerce order ID above to include a controlled quote probe without creating a return shipment.
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            label="Optional Return Tracking Number"
            value={probeTrackingNumber}
            onChange={(event) => setProbeTrackingNumber(event.target.value)}
            sx={{ minWidth: 280 }}
          />
          <Button variant="outlined" onClick={handleProbeShippit} disabled={probingShippit}>
            {probingShippit ? "Probing..." : "Probe Returns Endpoints"}
          </Button>
        </Stack>
        {probeResult ? (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Environment: {probeResult.environment}; checked: {probeResult.checked_at}; order probe: {probeResult.order_id ?? "not supplied"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Check</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {probeResult.results.map(result => (
                  <TableRow key={result.name}>
                    <TableCell>{result.name}</TableCell>
                    <TableCell>{result.method}</TableCell>
                    <TableCell>{result.status_code ?? result.error ?? "No response"}</TableCell>
                    <TableCell>{result.duration_ms}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
      </Paper>

      <Dialog open={confirmingLabel} onClose={() => !generatingLabel && setConfirmingLabel(false)}>
        <DialogTitle>Approve Return and Generate Label?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This action approves the return in Shippit and generates the customer return label. A status refresh alone does not do this.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingLabel(false)} disabled={generatingLabel}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleGenerateLabel} disabled={generatingLabel}>
            {generatingLabel ? "Generating..." : "Approve and Generate Label"}
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Return Cases</Typography>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ReturnStatus | "all")}
            >
              {RETURN_STATUS_OPTIONS.map(option => (
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
              <TableCell>Return</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Resolution</TableCell>
              <TableCell>Refund</TableCell>
              <TableCell>Lines</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.map(returnCase => (
              <Fragment key={returnCase.id}>
              <TableRow>
                <TableCell>#{returnCase.id}</TableCell>
                <TableCell>#{returnCase.order_id}</TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={returnCase.status}
                    disabled={saving}
                    onChange={(event) => handleStatusChange(returnCase, event.target.value as ReturnStatus)}
                  >
                    {RETURN_STATUS_OPTIONS.filter(option => option.value !== "all").map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>{returnCase.reason}</TableCell>
                <TableCell>{returnCase.resolution}</TableCell>
                <TableCell>{returnCase.refund_expected ? "May be required" : "No"}</TableCell>
                <TableCell>{returnCase.lines?.length ?? 0}</TableCell>
                <TableCell>{returnCase.updated_at}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => setExpandedReturnId(current => current === returnCase.id ? null : returnCase.id)}>
                    {expandedReturnId === returnCase.id ? "Hide" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
              {expandedReturnId === returnCase.id ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ bgcolor: "action.hover", py: 2 }}>
                    <ReturnShipmentDetails returnCase={returnCase} />
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
            ))}
            {!loading && returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    No return cases found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    Loading return cases...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default ReturnsPage;

function ReturnShipmentDetails({ returnCase }: { returnCase: ReturnCase }) {
  const order = returnCase.originating_order;
  const outbound = returnCase.outbound_shipment;
  const shipment = returnCase.return_shipment ?? {
    return_order_id: returnCase.shippit_return_order_id,
    tracking_number: returnCase.shippit_tracking_number,
    state: returnCase.shippit_state,
    label_url: returnCase.shippit_label_url,
  };
  const orderUrl = order ? wordpressAdminUrl(`admin.php?page=wc-orders&action=edit&id=${order.id}`) : null;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
        <Box>
          <Typography variant="subtitle2">Originating order</Typography>
          <Typography variant="body2">
            {orderUrl ? <a href={orderUrl} target="_blank" rel="noopener noreferrer">Order #{order?.number ?? returnCase.order_id}</a> : `Order #${order?.number ?? returnCase.order_id}`}
          </Typography>
          <Typography variant="body2">Order status: {order?.status_label ?? "-"}</Typography>
          <Typography variant="body2">Outbound fulfillment: {order?.fulfillment_status ?? "-"}</Typography>
          <Typography variant="body2">
            Outbound tracking: {outbound?.tracking_url
              ? <a href={outbound.tracking_url} target="_blank" rel="noopener noreferrer">{outbound.tracking_number || "Open tracking"}</a>
              : outbound?.tracking_number || "-"}
          </Typography>
          <Typography variant="body2">Outbound courier: {outbound?.courier_name || "-"}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Return shipment</Typography>
          <Typography variant="body2">Return status: {returnCase.status.replaceAll("_", " ")}</Typography>
          <Typography variant="body2">Shippit status: {shipment.state || "Not created"}</Typography>
          <Typography variant="body2">
            Return tracking: {shipment.tracking_url
              ? <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer">{shipment.tracking_number || "Open tracking"}</a>
              : shipment.tracking_number || "-"}
          </Typography>
          <Typography variant="body2">Courier: {shipment.courier_name || shipment.courier_type || "-"}</Typography>
          <Typography variant="body2">
            Quoted cost: {shipment.quoted_cost == null ? "Not recorded" : `${shipment.currency || order?.currency || ""} ${shipment.quoted_cost.toFixed(2)}`}
          </Typography>
          {shipment.label_url ? <Button size="small" href={shipment.label_url} target="_blank" rel="noopener noreferrer">Open return label</Button> : null}
        </Box>
      </Stack>
      <Box>
        <Typography variant="subtitle2">Parcel details</Typography>
        {(shipment.parcels ?? []).length
          ? shipment.parcels!.map((parcel, index) => <Typography variant="body2" key={index}>{formatParcel(parcel, index)}</Typography>)
          : <Typography variant="body2" color="text.secondary">No parcel details recorded.</Typography>}
      </Box>
      <Box>
        <Typography variant="subtitle2">Returned items</Typography>
        {returnCase.lines.map(line => (
          <Typography variant="body2" key={line.id ?? `${line.order_item_id}-${line.sku}`}>
            {line.product_name || line.sku || `Order item ${line.order_item_id}`} × {line.qty}
          </Typography>
        ))}
      </Box>
      {(shipment.tracking_history ?? []).length ? (
        <Box>
          <Typography variant="subtitle2">Tracking history</Typography>
          {shipment.tracking_history!.map((event, index) => (
            <Typography variant="body2" key={index}>
              {String(event.status ?? event.current_state ?? "Update")}{event.date ? ` — ${String(event.date)}` : ""}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}

function formatParcel(parcel: Record<string, unknown>, index: number): string {
  const length = parcel.length ?? "-";
  const width = parcel.width ?? "-";
  const depth = parcel.depth ?? parcel.height ?? "-";
  const weight = parcel.weight ?? "-";
  const type = parcel.package_type ? `, ${String(parcel.package_type)}` : "";
  const label = parcel.label_number ? `, label ${String(parcel.label_number)}` : "";
  return `Parcel ${index + 1}: ${String(length)} × ${String(width)} × ${String(depth)} m, ${String(weight)} kg${type}${label}`;
}

function extractQuoteRows(result: ShippitReturnsProbeResult): QuoteRow[] {
  const body = result.body;
  if (!body || typeof body !== "object" || !("response" in body)) {
    return [];
  }

  const response = (body as { response?: unknown }).response;
  if (!Array.isArray(response)) {
    return [];
  }

  const rows: QuoteRow[] = [];
  response.forEach(serviceResult => {
    if (!serviceResult || typeof serviceResult !== "object") {
      return;
    }
    const service = serviceResult as { success?: unknown; courier_type?: unknown; service_level?: unknown; quotes?: unknown };
    if (service.success !== true || !Array.isArray(service.quotes)) {
      return;
    }
    service.quotes.forEach(quote => {
      if (!quote || typeof quote !== "object") {
        return;
      }
      const quoteData = quote as { price?: unknown; estimated_transit_time?: unknown };
      const price = Number(quoteData.price);
      if (!Number.isFinite(price)) {
        return;
      }
      rows.push({
        courierType: String(service.courier_type ?? ""),
        serviceLevel: String(service.service_level ?? ""),
        price,
        estimatedTransitTime: String(quoteData.estimated_transit_time ?? ""),
      });
    });
  });
  return rows.sort((left, right) => left.price - right.price);
}

function quoteKey(quote: QuoteRow): string {
  return `${quote.courierType}|${quote.serviceLevel}|${quote.price}`;
}

function shippitErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const detail = readObject((error.responseBody as { detail?: unknown } | null)?.detail);
  const result = readObject(detail?.result);
  const body = readObject(result?.body);
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const firstError = readObject(errors[0]);
  const shippitMessage = typeof firstError?.message === "string" ? firstError.message : "";
  const shippitCode = typeof firstError?.code === "string" ? firstError.code : "";

  if (shippitMessage) {
    return shippitCode ? `Shippit error ${shippitCode}: ${shippitMessage}` : `Shippit error: ${shippitMessage}`;
  }

  return error.message || fallback;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
