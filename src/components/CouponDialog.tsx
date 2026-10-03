import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  CouponCreateResponse,
  CouponDiscountType,
  createCoupon,
} from "../api/couponApi";

type Props = {
  customerId?: number | null;
  cartId?: string | null;
  visitorId?: string | null;
  conversationId?: string | null;
  buttonLabel?: string;
};

export default function CouponDialog({
  customerId,
  cartId,
  visitorId,
  conversationId,
  buttonLabel = "Create coupon",
}: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [amount, setAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [deliverViaChat, setDeliverViaChat] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CouponCreateResponse | null>(null);
  const hasChatIdentity = Boolean(conversationId || cartId || visitorId || customerId);

  useEffect(() => {
    if (!open) return;
    setDeliverViaChat(hasChatIdentity);
    setError(null);
    setResult(null);
  }, [hasChatIdentity, open]);

  const invalidReason = useMemo(() => {
    if (!code.trim()) return "Enter a unique coupon code.";
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return "Enter a discount greater than zero.";
    }
    if (discountType === "percent" && numericAmount > 100) {
      return "Percentage discounts cannot exceed 100%.";
    }
    const numericLimit = Number(usageLimit);
    if (!Number.isInteger(numericLimit) || numericLimit < 1) {
      return "Usage limit must be at least one.";
    }
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
      return "Choose a future expiry time.";
    }
    return null;
  }, [amount, code, discountType, expiresAt, usageLimit]);

  const handleCreate = async () => {
    if (invalidReason) {
      setError(invalidReason);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createCoupon({
        code: code.trim(),
        discount_type: discountType,
        amount: Number(amount),
        usage_limit: Number(usageLimit),
        expires_at: new Date(expiresAt).toISOString(),
        custom_message: customMessage.trim() || undefined,
        customer_id: customerId || undefined,
        cart_id: cartId || undefined,
        visitor_id: visitorId || undefined,
        conversation_id: conversationId || undefined,
        deliver_via_chat: deliverViaChat,
      }, idempotencyKey);
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
    setCode("");
    setAmount("");
    setUsageLimit("1");
    setExpiresAt("");
    setCustomMessage("");
    setIdempotencyKey(crypto.randomUUID());
    setResult(null);
    setError(null);
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Create WooCommerce coupon</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {result ? (
              <Alert severity={couponResultSeverity(result.chat_delivery.status)}>
                <Typography variant="body2" fontWeight={700}>
                  Coupon {result.code} created.
                </Typography>
                <Typography variant="body2">{result.delivery_message}</Typography>
                <Typography variant="caption" display="block">
                  Chat delivery: {result.chat_delivery.status.replaceAll("_", " ")}
                  {result.chat_delivery.reason
                    ? ` — ${result.chat_delivery.reason.replaceAll("_", " ")}`
                    : ""}
                </Typography>
              </Alert>
            ) : (
              <>
                <TextField
                  label="Unique coupon code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  inputProps={{ maxLength: 64 }}
                  required
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Discount type"
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value as CouponDiscountType)}
                  >
                    <MenuItem value="percent">Percentage</MenuItem>
                    <MenuItem value="fixed_cart">Fixed cart amount</MenuItem>
                  </TextField>
                  <TextField
                    fullWidth
                    label={discountType === "percent" ? "Percentage" : "Amount"}
                    type="number"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputProps={{ min: 0.01, max: discountType === "percent" ? 100 : undefined, step: 0.01 }}
                    required
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="Usage limit"
                    type="number"
                    value={usageLimit}
                    onChange={(event) => setUsageLimit(event.target.value)}
                    inputProps={{ min: 1, step: 1 }}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Expires at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Stack>
                <TextField
                  label="Custom message"
                  multiline
                  minRows={3}
                  value={customMessage}
                  onChange={(event) => setCustomMessage(event.target.value)}
                  inputProps={{ maxLength: 1000 }}
                  helperText="This text appears before the generated coupon details."
                />
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={deliverViaChat}
                      onChange={(event) => setDeliverViaChat(event.target.checked)}
                      disabled={!hasChatIdentity}
                    />
                  )}
                  label="Deliver through the visitor's existing NY Chat conversation"
                />
                {!hasChatIdentity ? (
                  <Alert severity="info">
                    Chat delivery is unavailable because this record has no linked visitor,
                    cart, conversation, or Woo customer.
                  </Alert>
                ) : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{result ? "Close" : "Cancel"}</Button>
          {!result ? (
            <Button
              variant="contained"
              onClick={() => void handleCreate()}
              disabled={saving || Boolean(invalidReason)}
            >
              {saving ? "Creating…" : "Create coupon"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
}

function couponResultSeverity(
  status: CouponCreateResponse["chat_delivery"]["status"],
): "success" | "info" | "warning" | "error" {
  if (status === "delivered") return "success";
  if (status === "not_requested") return "info";
  if (status === "unavailable") return "warning";
  return "error";
}
