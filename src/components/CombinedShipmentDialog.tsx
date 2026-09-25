import {
  Alert,
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

export default function CombinedShipmentDialog({ open, orders, onClose, onCompleted }: Props) {
  const orderIds = useMemo(() => orders.map(order => Number(order.order_id)), [orders]);
  const [preview, setPreview] = useState<FulfillmentPreview | null>(null);
  const [parcels, setParcels] = useState<FulfillmentParcel[]>([]);
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [approveCancellation, setApproveCancellation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => fulfillmentQuoteOptions(quote), [quote]);
  const selectedQuote = options.find(option => option.id === selectedQuoteId) ?? null;

  useEffect(() => {
    if (!open || orderIds.length < 2) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setSelectedQuoteId(null);
    setApproveCancellation(false);
    previewFulfillment(orderIds)
      .then(result => {
        setPreview(result);
        setParcels(result.parcels);
      })
      .catch(error => setError(error instanceof Error ? error.message : "Failed to load combined shipment."))
      .finally(() => setLoading(false));
  }, [open, orderIds.join(","), orders]);

  const items = preview?.items.map(item => ({
    order_id: item.order_id,
    order_item_id: item.order_item_id,
    quantity: item.remaining_quantity,
  })) ?? [];
  const parcelsValid = parcels.length > 0
    && parcels.every(parcel => Object.values(parcel).every(value => Number(value) > 0));

  const requestQuote = async () => {
    if (!preview || !parcelsValid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await quoteFulfillment({ order_ids: orderIds, items, parcels });
      setQuote(result);
      setSelectedQuoteId(fulfillmentQuoteOptions(result)[0]?.id ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Combined quote failed.");
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    if (!preview || !selectedQuote || (preview.requires_cancellation && !approveCancellation)) return;
    setSaving(true);
    setError(null);
    try {
      await createFulfillment({
        operation_id: crypto.randomUUID(),
        order_ids: orderIds,
        items,
        parcels,
        quote_selection: selectedQuote,
        cancel_existing_shipments: approveCancellation,
        notify_customer: false,
      });
      onCompleted();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Combined shipment creation failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Combined shipment dimensions and quote</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">{orderIds.map(id => `#${id}`).join(", ")} will share one physical Shippit shipment and tracking number.</Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="subtitle2">Combined physical parcels — authoritative remaining quantities</Typography>
          {parcels.map((parcel, parcelIndex) => (
            <Stack key={`combined-parcel:${parcelIndex}`} direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Qty"
                type="number"
                value={parcel.qty}
                onChange={event => {
                  setParcels(previous => previous.map((entry, index) => index === parcelIndex
                    ? { ...entry, qty: Number(event.target.value) }
                    : entry));
                  setQuote(null);
                  setSelectedQuoteId(null);
                }}
                inputProps={{ min: 1, step: 1 }}
                fullWidth
              />
              {(["weight_kg", "length_cm", "width_cm", "height_cm"] as const).map(field => (
                <TextField
                  key={field}
                  label={{ weight_kg: "Weight kg", length_cm: "L cm", width_cm: "W cm", height_cm: "H cm" }[field]}
                  type="number"
                  value={parcel[field]}
                  onChange={event => {
                    setParcels(previous => previous.map((entry, index) => index === parcelIndex
                      ? { ...entry, [field]: Number(event.target.value) }
                      : entry));
                    setQuote(null);
                    setSelectedQuoteId(null);
                  }}
                  inputProps={{ min: 0, step: "any" }}
                  fullWidth
                />
              ))}
            </Stack>
          ))}
          {!parcelsValid && (
            <Alert severity="warning">Authoritative parcel dimensions are incomplete; enter measured values before quoting.</Alert>
          )}
          <Button variant="outlined" onClick={requestQuote} disabled={loading || !parcelsValid}>
            {loading ? "Requesting quotes…" : "Get combined shipment quotes"}
          </Button>
          {options.map(option => (
            <Card key={option.id} variant="outlined" sx={{ borderColor: selectedQuoteId === option.id ? "primary.main" : "divider" }}>
              <CardActionArea onClick={() => setSelectedQuoteId(option.id)}>
                <CardContent>
                  <Typography fontWeight={700}>{option.label} — ${Number(option.price).toFixed(2)}</Typography>
                  {option.estimated_transit_time && <Typography variant="body2">{option.estimated_transit_time}</Typography>}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
          {preview?.requires_cancellation && (
            <Alert severity="warning">
              The individual Shippit orders will be cancelled before the combined shipment is created.
              <FormControlLabel
                control={<Checkbox checked={approveCancellation} onChange={event => setApproveCancellation(event.target.checked)} />}
                label="Cancel the individual Shippit orders"
              />
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={create}
          disabled={saving || !selectedQuote || Boolean(preview?.requires_cancellation && !approveCancellation)}
        >
          {saving ? "Creating…" : "Create combined shipment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
