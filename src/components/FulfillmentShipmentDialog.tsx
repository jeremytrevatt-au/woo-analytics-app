import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  createFulfillment,
  FulfillmentOperation,
  FulfillmentParcel,
  FulfillmentPreview,
  previewFulfillment,
} from "../api/fulfillmentApi";

type Props = {
  open: boolean;
  orders: any[];
  onClose: () => void;
  onCompleted: () => void;
};

const emptyParcel: FulfillmentParcel = {
  qty: 1,
  weight_kg: 0,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
};

export default function FulfillmentShipmentDialog({
  open,
  orders,
  onClose,
  onCompleted,
}: Props) {
  const [preview, setPreview] = useState<FulfillmentPreview | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [parcel, setParcel] = useState<FulfillmentParcel>(emptyParcel);
  const [approveCancellation, setApproveCancellation] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [operation, setOperation] = useState<FulfillmentOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderIds = useMemo(
    () => orders.map(order => Number(order.order_id)).filter(Boolean),
    [orders],
  );

  useEffect(() => {
    if (!open || orderIds.length === 0) return;
    setIsLoading(true);
    setError(null);
    setOperation(null);
    setApproveCancellation(false);
    previewFulfillment(orderIds)
      .then(result => {
        setPreview(result);
        setQuantities(Object.fromEntries(
          result.items.map(item => [`${item.order_id}:${item.order_item_id}`, item.remaining_quantity]),
        ));
        const lineById = new Map<string, any>();
        orders.forEach(order => {
          (Array.isArray(order.lines) ? order.lines : []).forEach((line: any) => {
            lineById.set(`${order.order_id}:${line.order_item_id}`, line);
          });
        });
        const selectedLines = result.items.map(item => ({
          item,
          line: lineById.get(`${item.order_id}:${item.order_item_id}`),
        }));
        setParcel({
          qty: 1,
          weight_kg: Number((selectedLines.reduce(
            (total, entry) => total + Number(entry.line?.product_weight || 0) * entry.item.remaining_quantity,
            0,
          ) / 1000).toFixed(3)),
          length_cm: Math.max(0, ...selectedLines.map(entry => Number(entry.line?.product_length || 0))),
          width_cm: Math.max(0, ...selectedLines.map(entry => Number(entry.line?.product_width || 0))),
          height_cm: Math.max(0, ...selectedLines.map(entry => Number(entry.line?.product_height || 0))),
        });
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : "Failed to load fulfillment availability."))
      .finally(() => setIsLoading(false));
  }, [open, orderIds.join(","), orders]);

  const selectedItems = preview?.items
    .map(item => ({
      order_id: item.order_id,
      order_item_id: item.order_item_id,
      quantity: Number(quantities[`${item.order_id}:${item.order_item_id}`] || 0),
    }))
    .filter(item => item.quantity > 0) ?? [];

  const parcelIsValid = Object.entries(parcel).every(([, value]) => Number(value) > 0);
  const canSubmit = !isLoading
    && !isSaving
    && selectedItems.length > 0
    && parcelIsValid
    && (!preview?.requires_cancellation || approveCancellation);

  const submit = async () => {
    if (!preview || !canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await createFulfillment({
        operation_id: crypto.randomUUID(),
        order_ids: orderIds,
        items: selectedItems,
        parcels: [parcel],
        cancel_existing_shipments: approveCancellation,
        notify_customer: notifyCustomer,
      });
      setOperation(result);
      onCompleted();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Shipment creation failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {orders.length > 1 ? `Combine ${orders.length} orders` : `Partial fulfillment #${orderIds[0] || ""}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {operation && (
            <Alert severity={operation.status === "completed" ? "success" : "warning"}>
              Operation {operation.operation_id}: {operation.status}
              {operation.tracking_number ? ` — tracking ${operation.tracking_number}` : ""}
            </Alert>
          )}
          {preview && (
            <>
              <Alert severity="info">
                {preview.orders.map(order => `#${order.order_id}`).join(", ")} will share one Shippit shipment and tracking number.
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Recipient and delivery address</Typography>
                <Typography variant="body2">{preview.orders[0]?.recipient}</Typography>
                <Typography variant="body2" color="text.secondary">{preview.orders[0]?.address}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Shipping: {preview.orders.map(order => `#${order.order_id} ${order.shipping_methods.join(", ") || "Not recorded"}`).join(" · ")}
                </Typography>
              </Box>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Quantities to fulfill</Typography>
                {preview.items.map(item => {
                  const key = `${item.order_id}:${item.order_item_id}`;
                  return (
                    <Stack
                      key={key}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ sm: "center" }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>
                          #{item.order_id} — {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.sku || "No SKU"} · ordered {item.ordered_quantity} · refunded {item.refunded_quantity} · already fulfilled {item.fulfilled_quantity}
                        </Typography>
                      </Box>
                      <TextField
                        label="Ship now"
                        size="small"
                        type="number"
                        value={quantities[key] ?? 0}
                        inputProps={{ min: 0, max: item.remaining_quantity, step: 1 }}
                        onChange={event => setQuantities(previous => ({
                          ...previous,
                          [key]: Math.min(item.remaining_quantity, Math.max(0, Number(event.target.value) || 0)),
                        }))}
                        sx={{ width: { xs: "100%", sm: 120 } }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Physical parcel</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  {([
                    ["weight_kg", "Weight kg"],
                    ["length_cm", "Length cm"],
                    ["width_cm", "Width cm"],
                    ["height_cm", "Height cm"],
                  ] as const).map(([field, label]) => (
                    <TextField
                      key={field}
                      label={label}
                      type="number"
                      size="small"
                      value={parcel[field]}
                      inputProps={{ min: 0, step: "any" }}
                      onChange={event => setParcel(previous => ({
                        ...previous,
                        [field]: Number(event.target.value),
                      }))}
                      fullWidth
                    />
                  ))}
                </Stack>
                {!parcelIsValid && (
                  <Alert severity="warning">Enter the measured packed weight and all parcel dimensions.</Alert>
                )}
              </Stack>
              {preview.requires_cancellation && (
                <Alert severity="warning">
                  One or more source orders already has a Shippit order. Creation requires explicit cancellation while those orders remain cancellable.
                  <FormControlLabel
                    control={<Checkbox checked={approveCancellation} onChange={event => setApproveCancellation(event.target.checked)} />}
                    label="Cancel the existing Shippit order(s) and create this shipment"
                  />
                </Alert>
              )}
              <FormControlLabel
                control={<Checkbox checked={notifyCustomer} onChange={event => setNotifyCustomer(event.target.checked)} />}
                label="Send WooCommerce fulfillment notification to the customer"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {operation ? "Close" : "Cancel"}
        </Button>
        {!operation && (
          <Button variant="contained" color="success" onClick={submit} disabled={!canSubmit}>
            {isSaving ? "Creating shipment…" : "Create shipment"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
