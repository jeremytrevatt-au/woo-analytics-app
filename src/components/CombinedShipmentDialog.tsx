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
import type { PackingQuoteResponse, PackingQuoteSelection } from "../api/shippitPackingApi";

type Props = {
  open: boolean;
  orders: any[];
  onClose: () => void;
  onCompleted: () => void;
};

type QuoteOption = PackingQuoteSelection & { id: string; label: string };

function quoteOptions(response: PackingQuoteResponse | null): QuoteOption[] {
  const body = response?.body as { response?: unknown; quotes?: unknown } | unknown[] | undefined;
  const carriers = Array.isArray(body)
    ? body
    : body && Array.isArray((body as { response?: unknown }).response)
      ? (body as { response: unknown[] }).response
      : body && Array.isArray((body as { quotes?: unknown }).quotes)
        ? (body as { quotes: unknown[] }).quotes
        : [];
  const options: QuoteOption[] = [];
  carriers.forEach((carrier, carrierIndex) => {
    if (!carrier || typeof carrier !== "object") return;
    const carrierData = carrier as Record<string, unknown>;
    const rows = Array.isArray(carrierData.quotes) ? carrierData.quotes : [carrierData];
    rows.forEach((row, rowIndex) => {
      if (!row || typeof row !== "object") return;
      const quote = row as Record<string, unknown>;
      const courierType = String(carrierData.courier_type || quote.courier_type || "");
      const serviceLevel = String(carrierData.service_level || quote.service_level || "");
      const price = Number(quote.price);
      if ((!courierType && !serviceLevel) || !Number.isFinite(price) || price <= 0) return;
      options.push({
        id: `${carrierIndex}-${rowIndex}-${courierType}-${serviceLevel}`,
        label: String(carrierData.courier_name || quote.courier_name || courierType || serviceLevel),
        courier_type: courierType || null,
        service_level: serviceLevel || null,
        price,
        estimated_transit_time: typeof quote.estimated_transit_time === "string" ? quote.estimated_transit_time : null,
      });
    });
  });
  return options.sort((left, right) => Number(left.price) - Number(right.price));
}

export default function CombinedShipmentDialog({ open, orders, onClose, onCompleted }: Props) {
  const orderIds = useMemo(() => orders.map(order => Number(order.order_id)), [orders]);
  const [preview, setPreview] = useState<FulfillmentPreview | null>(null);
  const [parcel, setParcel] = useState<FulfillmentParcel>({ qty: 1, weight_kg: 0, length_cm: 0, width_cm: 0, height_cm: 0 });
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [approveCancellation, setApproveCancellation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => quoteOptions(quote), [quote]);
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
        const lines = orders.flatMap(order => Array.isArray(order.lines) ? order.lines : []);
        setParcel({
          qty: 1,
          weight_kg: Number((lines.reduce((total, line) => total + Number(line.product_weight || 0) * Number(line.qty || 0), 0) / 1000).toFixed(3)),
          length_cm: Math.max(0, ...lines.map(line => Number(line.product_length || 0))),
          width_cm: Math.max(0, ...lines.map(line => Number(line.product_width || 0))),
          height_cm: lines.reduce((total, line) => total + Number(line.product_height || 0), 0),
        });
      })
      .catch(error => setError(error instanceof Error ? error.message : "Failed to load combined shipment."))
      .finally(() => setLoading(false));
  }, [open, orderIds.join(","), orders]);

  const items = preview?.items.map(item => ({
    order_id: item.order_id,
    order_item_id: item.order_item_id,
    quantity: item.remaining_quantity,
  })) ?? [];
  const parcelValid = Object.values(parcel).every(value => Number(value) > 0);

  const requestQuote = async () => {
    if (!preview || !parcelValid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await quoteFulfillment({ order_ids: orderIds, items, parcels: [parcel] });
      setQuote(result);
      setSelectedQuoteId(quoteOptions(result)[0]?.id ?? null);
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
        parcels: [parcel],
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
          <Typography variant="subtitle2">Combined physical parcel — weight kg and L W H cm</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {(["weight_kg", "length_cm", "width_cm", "height_cm"] as const).map(field => (
              <TextField
                key={field}
                label={{ weight_kg: "Weight kg", length_cm: "L cm", width_cm: "W cm", height_cm: "H cm" }[field]}
                type="number"
                value={parcel[field]}
                onChange={event => {
                  setParcel(previous => ({ ...previous, [field]: Number(event.target.value) }));
                  setQuote(null);
                  setSelectedQuoteId(null);
                }}
                inputProps={{ min: 0, step: "any" }}
                fullWidth
              />
            ))}
          </Stack>
          <Button variant="outlined" onClick={requestQuote} disabled={loading || !parcelValid}>
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
