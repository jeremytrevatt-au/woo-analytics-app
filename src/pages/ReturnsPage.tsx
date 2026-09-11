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
  getReturnableOrderItems,
  listReturns,
  probeShippitReturnsEndpoints,
  ReturnableOrderResponse,
  ReturnCase,
  ReturnStatus,
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
      const response = await probeShippitReturnsEndpoints({ trackingNumber: probeTrackingNumber.trim() || undefined });
      setProbeResult(response);
      setMessage({ type: "success", text: "Shippit returns endpoint probe completed." });
    } catch (error: any) {
      setProbeResult(null);
      setMessage({ type: "error", text: error.message || "Failed to probe Shippit returns endpoints." });
    } finally {
      setProbingShippit(false);
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
            <Button variant="contained" onClick={handleCreate} disabled={saving}>
              Create Return
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Shippit Returns Diagnostics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Probes Shippit returns endpoints from the WordPress Shippit extension using empty validation payloads. This should verify endpoint names without creating a return shipment.
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
              Environment: {probeResult.environment}; checked: {probeResult.checked_at}
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
