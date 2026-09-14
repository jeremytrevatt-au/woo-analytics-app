import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Radio,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { getPackingShippitOrder, previewPackingQuote, updatePackingShippitOrder } from "../api/shippitPackingApi";
import type { PackingQuoteParcel, PackingQuoteResponse, PackingQuoteSelection, PackingShippitOrderParcel, PackingShippitOrderResponse } from "../api/shippitPackingApi";

type ParcelDraft = {
  id: string;
  qty: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

type Props = {
  open: boolean;
  order: any | null;
  onClose: () => void;
};

type QuoteOption = PackingQuoteSelection & {
  id: string;
  label: string;
  raw: unknown;
};

function numericString(value: unknown): string {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? String(numberValue) : "";
}

function buildParcelsFromShippitOrder(parcels: PackingShippitOrderParcel[]): ParcelDraft[] {
  return parcels.map(parcel => ({
    id: crypto.randomUUID(),
    qty: numericString(parcel.qty) || "1",
    weightGrams: numericString(parcel.weight_g),
    lengthCm: numericString(parcel.length_cm),
    widthCm: numericString(parcel.width_cm),
    heightCm: numericString(parcel.height_cm),
  }));
}

function parseParcels(parcels: ParcelDraft[]): PackingQuoteParcel[] {
  return parcels.map(parcel => ({
    qty: Number(parcel.qty),
    weight_kg: Number(parcel.weightGrams) / 1000,
    length_cm: Number(parcel.lengthCm),
    width_cm: Number(parcel.widthCm),
    height_cm: Number(parcel.heightCm),
  }));
}

function hasInvalidParcel(parcels: PackingQuoteParcel[]): boolean {
  return parcels.some(parcel =>
    !Number.isInteger(parcel.qty)
    || parcel.qty < 1
    || parcel.weight_kg <= 0
    || parcel.length_cm <= 0
    || parcel.width_cm <= 0
    || parcel.height_cm <= 0
  );
}

function countQuoteItems(response: PackingQuoteResponse | null): number {
  const body = response?.body as { response?: unknown; quotes?: unknown } | unknown[] | null | undefined;
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === "object" && Array.isArray((body as { response?: unknown }).response)) {
    return ((body as { response: unknown[] }).response).length;
  }
  if (body && typeof body === "object" && Array.isArray((body as { quotes?: unknown }).quotes)) {
    return ((body as { quotes: unknown[] }).quotes).length;
  }
  return 0;
}

function extractQuoteOptions(response: PackingQuoteResponse | null): QuoteOption[] {
  const body = response?.body as { response?: unknown; quotes?: unknown } | unknown[] | null | undefined;
  const carriers = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { response?: unknown }).response)
      ? (body as { response: unknown[] }).response
      : body && typeof body === "object" && Array.isArray((body as { quotes?: unknown }).quotes)
        ? (body as { quotes: unknown[] }).quotes
        : [];

  const options: QuoteOption[] = [];
  carriers.forEach((carrier, carrierIndex) => {
    if (!carrier || typeof carrier !== "object") return;
    const carrierData = carrier as Record<string, unknown>;
    const quoteRows = Array.isArray(carrierData.quotes) ? carrierData.quotes : [carrierData];
    quoteRows.forEach((quoteRow, quoteIndex) => {
      if (!quoteRow || typeof quoteRow !== "object") return;
      const quoteData = quoteRow as Record<string, unknown>;
      const courierType = String(carrierData.courier_type || quoteData.courier_type || "");
      const serviceLevel = String(carrierData.service_level || quoteData.service_level || "");
      const price = Number(quoteData.price);
      if (!courierType && !serviceLevel) return;
      if (quoteData.success === false || carrierData.success === false) return;
      if (!Number.isFinite(price) || price <= 0) return;
      options.push({
        id: `${courierType || "courier"}-${serviceLevel || "service"}-${carrierIndex}-${quoteIndex}`,
        label: String(carrierData.courier_name || quoteData.courier_name || courierType || serviceLevel),
        courier_type: courierType || null,
        service_level: serviceLevel || null,
        price,
        estimated_transit_time: typeof quoteData.estimated_transit_time === "string" ? quoteData.estimated_transit_time : null,
        raw: { carrier: carrierData, quote: quoteData },
      });
    });
  });
  return options.sort((left, right) => Number(left.price) - Number(right.price));
}

function formatPrice(price: number | null | undefined): string {
  return typeof price === "number" && Number.isFinite(price) ? `$${price.toFixed(2)}` : "Price not returned";
}

function PackingDimensionsDialog({ open, order, onClose }: Props) {
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [shippitOrder, setShippitOrder] = useState<PackingShippitOrderResponse | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExistingOrder, setLoadingExistingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setParcels([]);
    setQuote(null);
    setShippitOrder(null);
    setMessage(null);
    setLoadingExistingOrder(false);
    setSavingOrder(false);
    setSelectedQuoteId(null);
    setDebugOpen(false);

    if (!order?.order_id) return;

    setLoadingExistingOrder(true);
    getPackingShippitOrder(Number(order.order_id))
      .then(response => {
        if (cancelled) return;
        setShippitOrder(response);
        if (response.has_shippit_order && Array.isArray(response.parcels) && response.parcels.length > 0) {
          setParcels(buildParcelsFromShippitOrder(response.parcels));
        } else {
          setParcels([]);
        }
        setMessage({
          type: response.has_shippit_order ? "info" : "warning",
          text: response.message || (response.has_shippit_order ? "Existing Shippit order loaded." : "Shippit Order doesn't exist - check Australia Post."),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Failed to load existing Shippit order.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingExistingOrder(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, order]);

  const canEditShippitOrder = Boolean(shippitOrder?.has_shippit_order && shippitOrder.can_edit);
  const hasShippitOrder = Boolean(shippitOrder?.has_shippit_order);

  const validateParcels = (parsedParcels: PackingQuoteParcel[]) => {
    if (hasInvalidParcel(parsedParcels)) {
      setMessage({ type: "error", text: "Each parcel needs qty >= 1 and positive weight in grams plus length/width/height in cm." });
      return false;
    }
    return true;
  };

  const quoteCount = useMemo(() => countQuoteItems(quote), [quote]);
  const quoteOptions = useMemo(() => extractQuoteOptions(quote), [quote]);
  const selectedQuote = quoteOptions.find(option => option.id === selectedQuoteId) ?? null;

  const updateParcel = (id: string, field: keyof Omit<ParcelDraft, "id">, value: string) => {
    setParcels(previous => previous.map(parcel => parcel.id === id ? { ...parcel, [field]: value } : parcel));
  };

  const addParcel = () => {
    setParcels(previous => [
      ...previous,
      {
        id: crypto.randomUUID(),
        qty: "1",
        weightGrams: "",
        lengthCm: "",
        widthCm: "",
        heightCm: "",
      },
    ]);
  };

  const removeParcel = (id: string) => {
    setParcels(previous => previous.length > 1 ? previous.filter(parcel => parcel.id !== id) : previous);
  };

  const handleQuote = async () => {
    if (!order?.order_id) return;
    const parsedParcels = parseParcels(parcels);
    if (!validateParcels(parsedParcels)) return;

    setLoading(true);
    setMessage(null);
    setQuote(null);
    try {
      const response = await previewPackingQuote(Number(order.order_id), parsedParcels);
      setQuote(response);
      const options = extractQuoteOptions(response);
      setSelectedQuoteId(options[0]?.id ?? null);
      const responseQuoteCount = options.length || countQuoteItems(response);
      setMessage({ type: "success", text: `Shippit returned ${responseQuoteCount || "one or more"} quote response(s).` });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to retrieve Shippit quote." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShippitOrder = async () => {
    if (!order?.order_id || !canEditShippitOrder) return;
    const parsedParcels = parseParcels(parcels);
    if (!validateParcels(parsedParcels)) return;

    setSavingOrder(true);
    setMessage(null);
    try {
      const response = await updatePackingShippitOrder(Number(order.order_id), parsedParcels, null);
      setShippitOrder(response);
      if (Array.isArray(response.parcels) && response.parcels.length > 0) {
        setParcels(buildParcelsFromShippitOrder(response.parcels));
      }
      setMessage({ type: "success", text: "Existing Shippit order parcel dimensions were updated." });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to update existing Shippit order." });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSubmitSelectedQuote = async () => {
    if (!order?.order_id || !canEditShippitOrder || !selectedQuote) return;
    const parsedParcels = parseParcels(parcels);
    if (!validateParcels(parsedParcels)) return;

    setSavingOrder(true);
    setMessage(null);
    try {
      const response = await updatePackingShippitOrder(Number(order.order_id), parsedParcels, selectedQuote);
      setShippitOrder(response);
      if (Array.isArray(response.parcels) && response.parcels.length > 0) {
        setParcels(buildParcelsFromShippitOrder(response.parcels));
      }
      setMessage({ type: "success", text: `Selected quote submitted to Shippit: ${selectedQuote.label}.` });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to submit selected quote to Shippit." });
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>
          Packing Dimensions{order?.order_id ? ` - Order #${order.order_id}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Loads the existing Shippit order when one exists. Dimensions are centimetres; weight is grams.
            </Typography>

            {loadingExistingOrder ? (
              <Alert severity="info">Loading existing Shippit order before showing parcel dimensions...</Alert>
            ) : null}

            {shippitOrder?.has_shippit_order ? (
              <Alert severity={canEditShippitOrder ? "info" : "warning"}>
                Shippit {shippitOrder.shippit_tracking_number || "order"} is {shippitOrder.shippit_state || "unknown"}.
                {shippitOrder.courier_allocation ? ` Current courier: ${shippitOrder.courier_allocation}.` : ""}
                {canEditShippitOrder ? " Parcel and quote changes can be saved." : " Parcel changes are read-only in this state."}
              </Alert>
            ) : null}

            {message ? (
              <Alert severity={message.type}>
                {message.text}
              </Alert>
            ) : null}

            {!loadingExistingOrder && hasShippitOrder ? (
              <>
                {parcels.map((parcel, index) => (
                  <Box key={parcel.id} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Parcel {index + 1}</Typography>
                      <IconButton aria-label="Remove parcel" onClick={() => removeParcel(parcel.id)} disabled={parcels.length === 1}>
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label="Qty" type="number" value={parcel.qty} onChange={(event) => updateParcel(parcel.id, "qty", event.target.value)} inputProps={{ min: 1, step: 1 }} />
                      <TextField label="Weight g" type="number" value={parcel.weightGrams} onChange={(event) => updateParcel(parcel.id, "weightGrams", event.target.value)} inputProps={{ min: 0, step: 1 }} />
                      <TextField label="Length cm" type="number" value={parcel.lengthCm} onChange={(event) => updateParcel(parcel.id, "lengthCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
                      <TextField label="Width cm" type="number" value={parcel.widthCm} onChange={(event) => updateParcel(parcel.id, "widthCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
                      <TextField label="Height cm" type="number" value={parcel.heightCm} onChange={(event) => updateParcel(parcel.id, "heightCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
                    </Stack>
                  </Box>
                ))}

                <Button variant="outlined" onClick={addParcel}>
                  Add Parcel
                </Button>
              </>
            ) : null}

            {quote ? (
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    Shippit Quotes{quoteOptions.length ? ` (${quoteOptions.length})` : quoteCount ? ` (${quoteCount})` : ""}
                  </Typography>
                  <Button size="small" onClick={() => setDebugOpen(true)}>Debug JSON</Button>
                </Stack>
                {quoteOptions.length > 0 ? (
                  <Stack spacing={1.5}>
                    {quoteOptions.map((option, index) => (
                      <Card
                        key={option.id}
                        variant="outlined"
                        sx={{ cursor: "pointer", borderColor: selectedQuoteId === option.id ? "primary.main" : "divider" }}
                        onClick={() => setSelectedQuoteId(option.id)}
                      >
                        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Radio checked={selectedQuoteId === option.id} onChange={() => setSelectedQuoteId(option.id)} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2">{option.label}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {option.service_level || "Service level not returned"}
                                {option.estimated_transit_time ? ` - ${option.estimated_transit_time}` : ""}
                              </Typography>
                            </Box>
                            {index === 0 ? <Chip label="Cheapest" color="success" size="small" /> : null}
                            <Chip label={formatPrice(option.price)} color="primary" variant="outlined" />
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="warning">No selectable Shippit quote options were returned. Use Debug JSON for the raw response.</Alert>
                )}
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button variant="outlined" onClick={handleSaveShippitOrder} disabled={savingOrder || loadingExistingOrder || !canEditShippitOrder}>
            {savingOrder ? "Saving..." : "Save Parcels"}
          </Button>
          <Button variant="outlined" onClick={handleQuote} disabled={loading || loadingExistingOrder || !order || !hasShippitOrder}>
            {loading ? "Requesting Quote..." : "Get Shippit Quotes"}
          </Button>
          <Button variant="contained" onClick={handleSubmitSelectedQuote} disabled={savingOrder || loadingExistingOrder || !canEditShippitOrder || !selectedQuote}>
            {savingOrder ? "Submitting..." : "Submit Selected Quote"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={debugOpen} onClose={() => setDebugOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Shippit Quote Debug JSON</DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1, overflow: "auto", fontSize: 12, maxHeight: 520 }}>
            {JSON.stringify(quote?.body, null, 2)}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button onClick={() => setDebugOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PackingDimensionsDialog;
