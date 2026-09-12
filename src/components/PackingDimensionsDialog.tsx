import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { previewPackingQuote } from "../api/shippitPackingApi";
import type { PackingQuoteParcel, PackingQuoteResponse } from "../api/shippitPackingApi";

type ParcelDraft = {
  id: string;
  qty: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

type Props = {
  open: boolean;
  order: any | null;
  onClose: () => void;
};

function numericString(value: unknown): string {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? String(numberValue) : "";
}

function buildInitialParcels(order: any | null): ParcelDraft[] {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const physicalLines = lines.filter((line: any) => !line.is_bundle_parent);
  const totalWeight = physicalLines.reduce((sum: number, line: any) => {
    const qty = Number(line.qty || 0);
    const weight = Number(line.product_weight || 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(weight) ? qty * weight : 0);
  }, 0);
  const maxLength = Math.max(0, ...physicalLines.map((line: any) => Number(line.product_length || 0)));
  const maxWidth = Math.max(0, ...physicalLines.map((line: any) => Number(line.product_width || 0)));
  const maxHeight = Math.max(0, ...physicalLines.map((line: any) => Number(line.product_height || 0)));

  return [
    {
      id: crypto.randomUUID(),
      qty: "1",
      weightKg: numericString(totalWeight),
      lengthCm: numericString(maxLength),
      widthCm: numericString(maxWidth),
      heightCm: numericString(maxHeight),
    },
  ];
}

function parseParcels(parcels: ParcelDraft[]): PackingQuoteParcel[] {
  return parcels.map(parcel => ({
    qty: Number(parcel.qty),
    weight_kg: Number(parcel.weightKg),
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

function PackingDimensionsDialog({ open, order, onClose }: Props) {
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [quote, setQuote] = useState<PackingQuoteResponse | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setParcels(buildInitialParcels(order));
      setQuote(null);
      setMessage(null);
    }
  }, [open, order]);

  const quoteCount = useMemo(() => countQuoteItems(quote), [quote]);

  const updateParcel = (id: string, field: keyof Omit<ParcelDraft, "id">, value: string) => {
    setParcels(previous => previous.map(parcel => parcel.id === id ? { ...parcel, [field]: value } : parcel));
  };

  const addParcel = () => {
    setParcels(previous => [
      ...previous,
      {
        id: crypto.randomUUID(),
        qty: "1",
        weightKg: "",
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
    if (hasInvalidParcel(parsedParcels)) {
      setMessage({ type: "error", text: "Each parcel needs qty >= 1 and positive weight/length/width/height." });
      return;
    }

    setLoading(true);
    setMessage(null);
    setQuote(null);
    try {
      const response = await previewPackingQuote(Number(order.order_id), parsedParcels);
      setQuote(response);
      const responseQuoteCount = countQuoteItems(response);
      setMessage({ type: "success", text: `Shippit returned ${responseQuoteCount || "one or more"} quote response(s).` });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to retrieve Shippit quote." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Packing Dimensions{order?.order_id ? ` - Order #${order.order_id}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Configure the physical parcels to send to Shippit for a live outbound quote. Dimensions are centimetres; weight is kilograms.
          </Typography>

          {message ? (
            <Alert severity={message.type}>
              {message.text}
            </Alert>
          ) : null}

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
                <TextField label="Weight kg" type="number" value={parcel.weightKg} onChange={(event) => updateParcel(parcel.id, "weightKg", event.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                <TextField label="Length cm" type="number" value={parcel.lengthCm} onChange={(event) => updateParcel(parcel.id, "lengthCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
                <TextField label="Width cm" type="number" value={parcel.widthCm} onChange={(event) => updateParcel(parcel.id, "widthCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
                <TextField label="Height cm" type="number" value={parcel.heightCm} onChange={(event) => updateParcel(parcel.id, "heightCm", event.target.value)} inputProps={{ min: 0, step: 0.1 }} />
              </Stack>
            </Box>
          ))}

          <Button variant="outlined" onClick={addParcel}>
            Add Parcel
          </Button>

          {quote ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Shippit Response{quoteCount ? ` (${quoteCount} quote item${quoteCount === 1 ? "" : "s"})` : ""}
              </Typography>
              <Box component="pre" sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1, overflow: "auto", fontSize: 12, maxHeight: 360 }}>
                {JSON.stringify(quote.body, null, 2)}
              </Box>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={handleQuote} disabled={loading || !order}>
          {loading ? "Requesting Quote..." : "Get Shippit Quotes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PackingDimensionsDialog;
