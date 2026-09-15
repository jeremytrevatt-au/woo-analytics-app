import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
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

const RETURN_STATUS_OPTIONS: Array<{ value: ReturnStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
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

      await createReturn({
        order_id: numericOrderId,
        reason,
        resolution,
        refund_expected: refundExpected,
        notes,
        lines: selectedLines,
      });
      setOrderId("");
      setReason("");
      setResolution("");
      setRefundExpected(false);
      setNotes("");
      setReturnableOrder(null);
      setReturnLineQty({});
      setMessage({ type: "success", text: "Return case created." });
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

  const handleCreateShippitReturn = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }

    const lines = selectedReturnLines();
    if (lines.length === 0) {
      setMessage({ type: "error", text: "Enter at least one return quantity before creating a Shippit return." });
      return;
    }

    setCreatingShippitReturn(true);
    setMessage(null);
    try {
      const response = await createShippitReturnOrder({ orderId: numericOrderId, lines });
      setShippitReturn(response);
      const returnId = response.return.return_order_id;
      const labelReady = Boolean(response.return.label_url);
      setMessage({
        type: "success",
        text: labelReady
          ? `Shippit return ${returnId} created and label is ready.`
          : `Shippit return ${returnId} created. Poll status until the label URL is ready.`,
      });
    } catch (error: any) {
      setShippitReturn(null);
      setMessage({ type: "error", text: error.message || "Failed to create Shippit return." });
    } finally {
      setCreatingShippitReturn(false);
    }
  };

  const handlePollShippitReturn = async () => {
    const numericOrderId = Number(orderId);
    const returnOrderId = shippitReturn?.return.return_order_id;
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0 || !returnOrderId) {
      setMessage({ type: "error", text: "Create a Shippit return before polling its status." });
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
          ? "Shippit return label is ready."
          : "Shippit return status refreshed. Label URL is not ready yet.",
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to poll Shippit return." });
    } finally {
      setPollingShippitReturn(false);
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
                setShippitReturn(null);
                setQuotePreview(null);
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
            <Button variant="outlined" onClick={handlePreviewQuote} disabled={previewingQuote || saving}>
              {previewingQuote ? "Loading Quote..." : "Preview Return Quote"}
            </Button>
            <Button variant="contained" color="secondary" onClick={handleCreateShippitReturn} disabled={creatingShippitReturn || saving || !returnableOrder}>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {extractQuoteRows(quotePreview).map((quote, index) => (
                    <TableRow key={`${quote.courierType}-${quote.serviceLevel}-${index}`}>
                      <TableCell>{quote.courierType}</TableCell>
                      <TableCell>{quote.serviceLevel}</TableCell>
                      <TableCell align="right">${quote.price.toFixed(2)}</TableCell>
                      <TableCell>{quote.estimatedTransitTime || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {extractQuoteRows(quotePreview).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
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
                    {pollingShippitReturn ? "Polling..." : "Poll Label / Status"}
                  </Button>
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
            <Button variant="outlined" onClick={handleCreate} disabled={saving}>
              Create Internal Return Case
            </Button>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.map(returnCase => (
              <TableRow key={returnCase.id}>
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
              </TableRow>
            ))}
            {!loading && returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">
                    No return cases found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>
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
