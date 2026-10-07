import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
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
  quoteFulfillment,
} from "../api/fulfillmentApi";
import type { PackingQuoteResponse } from "../api/shippitPackingApi";
import { fulfillmentQuoteOptions } from "../lib/fulfillmentQuotes";

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
  const [parcels, setParcels] = useState<FulfillmentParcel[]>([emptyParcel]);
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [approveCancellation, setApproveCancellation] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [operation, setOperation] = useState<FulfillmentOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quoteOptions = useMemo(() => fulfillmentQuoteOptions(quote), [quote]);
  const selectedQuote = quoteOptions.find(option => option.id === selectedQuoteId) ?? null;

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
    setQuote(null);
    setSelectedQuoteId(null);
    previewFulfillment(orderIds)
      .then(result => {
        setPreview(result);
        setQuantities(Object.fromEntries(
          result.items.map(item => [`${item.order_id}:${item.order_item_id}`, item.remaining_quantity]),
        ));
        setParcels(result.parcels.length > 0 ? result.parcels : [emptyParcel]);
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

  const parcelsAreValid = parcels.length > 0
    && parcels.every(parcel => Object.values(parcel).every(value => Number(value) > 0));
  const canSubmit = !isLoading
    && !isSaving
    && selectedItems.length > 0
    && parcelsAreValid
    && Boolean(selectedQuote)
    && (!preview?.requires_cancellation || approveCancellation);

  const requestQuote = async () => {
    if (!preview || selectedItems.length === 0 || !parcelsAreValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await quoteFulfillment({
        order_ids: orderIds,
        items: selectedItems,
        parcels,
      });
      setQuote(result);
      setSelectedQuoteId(fulfillmentQuoteOptions(result)[0]?.id ?? null);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Shipment quote failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    if (!preview || !canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await createFulfillment({
        operation_id: crypto.randomUUID(),
        order_ids: orderIds,
        items: selectedItems,
        parcels,
        quote_selection: selectedQuote,
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
                {preview.orders.map(order => `#${order.order_id}`).join(", ")} will share one shipment and tracking number. Choose a Shippit courier or an Australia Post postage product.
              </Alert>
              {preview.existing_shippit.some(shipment => shipment.is_history) && (
                <Alert severity="success">
                  Previous shipment history retained:{" "}
                  {preview.existing_shippit
                    .filter(shipment => shipment.is_history)
                    .map(shipment => `${shipment.tracking_number} (${shipment.state || "closed"})`)
                    .join(", ")}. It will not be cancelled or reused for this fulfillment.
                </Alert>
              )}
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
                        onInput={() => {
                          setQuote(null);
                          setSelectedQuoteId(null);
                        }}
                        sx={{ width: { xs: "100%", sm: 120 } }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Typography variant="subtitle2">Physical parcels for remaining items</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isLoading || selectedItems.length === 0}
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      setQuote(null);
                      setSelectedQuoteId(null);
                      try {
                        const refreshed = await previewFulfillment(orderIds, selectedItems);
                        setParcels(refreshed.parcels.length > 0 ? refreshed.parcels : [emptyParcel]);
                      } catch (previewError) {
                        setError(previewError instanceof Error ? previewError.message : "Parcel recommendation failed.");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Recalculate from selected quantities
                  </Button>
                </Stack>
                {parcels.map((parcel, parcelIndex) => (
                  <Stack key={`parcel:${parcelIndex}`} direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      label="Qty"
                      type="number"
                      size="small"
                      value={parcel.qty}
                      inputProps={{ min: 1, step: 1 }}
                      onChange={event => {
                        setParcels(previous => previous.map((entry, index) => index === parcelIndex
                          ? { ...entry, qty: Number(event.target.value) }
                          : entry));
                        setQuote(null);
                        setSelectedQuoteId(null);
                      }}
                      fullWidth
                    />
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
                        onChange={event => {
                          setParcels(previous => previous.map((entry, index) => index === parcelIndex
                            ? { ...entry, [field]: Number(event.target.value) }
                            : entry));
                          setQuote(null);
                          setSelectedQuoteId(null);
                        }}
                        fullWidth
                      />
                    ))}
                  </Stack>
                ))}
                {!parcelsAreValid && (
                  <Alert severity="warning">Enter the measured packed weight and all parcel dimensions.</Alert>
                )}
                <Button
                  variant="outlined"
                  onClick={requestQuote}
                  disabled={isLoading || selectedItems.length === 0 || !parcelsAreValid}
                >
                  {isLoading ? "Requesting quotes…" : "Get shipping quotes"}
                </Button>
                {quote?.carriers?.shippit?.error_code && (
                  <Alert severity="warning">
                    Shippit quotes are unavailable ({quote.carriers.shippit.error_code}).
                  </Alert>
                )}
                {quote?.carriers?.australia_post?.error_code && (
                  <Alert severity="warning">
                    Australia Post quotes are unavailable ({quote.carriers.australia_post.error_code}
                    {quote.carriers.australia_post.plugin_version ? `, Labels Pro ${quote.carriers.australia_post.plugin_version}` : ""}).
                  </Alert>
                )}
                {quoteOptions.map(option => (
                  <Card
                    key={option.id}
                    variant="outlined"
                    sx={{ borderColor: selectedQuoteId === option.id ? "primary.main" : "divider" }}
                  >
                    <CardActionArea onClick={() => setSelectedQuoteId(option.id)}>
                      <CardContent>
                        <Typography fontWeight={700}>
                          {option.label} — ${Number(option.price).toFixed(2)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.carrier_id === "australia_post" ? "Australia Post" : "Shippit"}
                        </Typography>
                        {option.estimated_transit_time && (
                          <Typography variant="body2">{option.estimated_transit_time}</Typography>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
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
            {isSaving ? "Creating shipment…" : selectedQuote ? "Create quoted shipment" : "Select a quote"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
