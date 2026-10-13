import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AdditionalShippingPreview,
  AdditionalShippingQuote,
  createAdditionalShipping,
  previewAdditionalShipping,
  sendAdditionalShippingEmail,
} from "../api/additionalShippingApi";

type Props = {
  orderId: number;
  quote: AdditionalShippingQuote | null;
  hidden?: boolean;
};

export default function AdditionalShippingCost({ orderId, quote, hidden = false }: Props) {
  const [preview, setPreview] = useState<AdditionalShippingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const quoteKey = quote
    ? [quote.carrier_id, quote.courier_type, quote.service_level, quote.product_id, quote.price, quote.total_cost].join("|")
    : "";
  const quoteRef = useRef(quote);
  quoteRef.current = quote;

  useEffect(() => {
    const selected = quoteRef.current;
    if (hidden || !orderId || !selected || !quoteKey) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setError(null);
    previewAdditionalShipping(orderId, selected)
      .then(result => {
        if (!cancelled) setPreview(result);
      })
      .catch((previewError: unknown) => {
        if (cancelled) return;
        setPreview(null);
        setError(previewError instanceof Error ? previewError.message : "The shipping difference could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [hidden, orderId, quoteKey]);

  if (hidden || !quote) return null;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await createAdditionalShipping(orderId, quote);
      await sendAdditionalShippingEmail(orderId, true);
      setConfirmOpen(false);
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : "The additional shipping email could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={1}>
      {error && <Alert severity="error">{error}</Alert>}
      {preview?.show_action && (
        <>
          <Typography variant="body2">Paid shipping: {preview.paid_shipping_display}</Typography>
          <Typography variant="body2">New shipping: {preview.new_shipping_display}</Typography>
          <Typography variant="body2">Difference: {preview.difference_display}</Typography>
          <Button variant="contained" onClick={() => setConfirmOpen(true)}>
            Send Extra Shipping Cost Email to Customer
          </Button>
          <Dialog open={confirmOpen} onClose={sending ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Send extra shipping cost email</DialogTitle>
            <DialogContent>
              <TextField
                label="Recipient"
                value={preview.billing_email}
                fullWidth
                margin="normal"
                disabled
                inputProps={{ readOnly: true, "aria-label": "Recipient" }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmOpen(false)} disabled={sending}>Cancel</Button>
              <Button variant="contained" onClick={send} disabled={sending}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Stack>
  );
}
