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
import { getCustomerContact } from "../api/customerContactApi";
import {
  CouponCreateResponse,
  CouponDiscountType,
  createCoupon,
} from "../api/couponApi";
import {
  couponDialogInvalidReason,
  couponRestrictionEmail,
  defaultCouponExpiryLocal,
} from "../lib/couponEmail";

type Props = {
  customerId?: number | null;
  cartId?: string | null;
  visitorId?: string | null;
  conversationId?: string | null;
  restrictEmail?: string | null;
  buttonLabel?: string;
};

export default function CouponDialog({
  customerId,
  cartId,
  visitorId,
  conversationId,
  restrictEmail,
  buttonLabel = "Create coupon",
}: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [amount, setAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [emailRestriction, setEmailRestriction] = useState("");
  const [deliverViaChat, setDeliverViaChat] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CouponCreateResponse | null>(null);
  const hasChatIdentity = Boolean(conversationId || cartId || visitorId || customerId);
  const knownEmail = couponRestrictionEmail(restrictEmail);

  useEffect(() => {
    if (!open) return;
    setDeliverViaChat(hasChatIdentity);
    setError(null);
    setResult(null);
    setExpiresAt((current) => current || defaultCouponExpiryLocal());
    setEmailRestriction(knownEmail);
    if (!customerId) return;
    let active = true;
    void getCustomerContact(customerId)
      .then((contact) => {
        if (!active) return;
        setEmailRestriction((current) => (
          current.trim()
            ? current
            : couponRestrictionEmail(knownEmail, contact.user_email, contact.billing_email)
        ));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [customerId, hasChatIdentity, knownEmail, open]);

  const invalidReason = useMemo(
    () => couponDialogInvalidReason({
      code,
      amount,
      discountType,
      usageLimit,
      expiresAt,
      freeShipping,
      emailRestriction,
    }),
    [amount, code, discountType, emailRestriction, expiresAt, freeShipping, usageLimit],
  );

  const handleCreate = async () => {
    if (invalidReason) {
      setError(invalidReason);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const typedEmail = emailRestriction.trim();
      const payload = {
        code: code.trim(),
        discount_type: discountType,
        usage_limit: Number(usageLimit),
        expires_at: new Date(expiresAt).toISOString(),
        custom_message: customMessage.trim() || undefined,
        customer_id: customerId || undefined,
        cart_id: cartId || undefined,
        visitor_id: visitorId || undefined,
        conversation_id: conversationId || undefined,
        deliver_via_chat: deliverViaChat,
        free_shipping: freeShipping,
        email_restrictions: typedEmail || undefined,
        ...(amount.trim() === "" ? {} : { amount: Number(amount) }),
      };
      const response = await createCoupon(payload, idempotencyKey);
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
    setFreeShipping(false);
    setEmailRestriction("");
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
                    inputProps={{ min: freeShipping ? 0 : 0.01, max: discountType === "percent" ? 100 : undefined, step: 0.01 }}
                    required={!freeShipping}
                    helperText={freeShipping ? "Optional for a free-shipping-only coupon." : undefined}
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
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={freeShipping}
                      onChange={(event) => setFreeShipping(event.target.checked)}
                    />
                  )}
                  label="Free shipping"
                />
                <TextField
                  label="Restrict to email"
                  type="email"
                  value={emailRestriction}
                  onChange={(event) => setEmailRestriction(event.target.value)}
                  inputProps={{ maxLength: 320 }}
                  helperText="Optional. Limits the coupon to this address. Prefills from the Woo user email, billing email, chat guest, or conversation identity when known."
                />
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
          {!result && invalidReason ? (
            <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 2 }}>
              {invalidReason}
            </Typography>
          ) : null}
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
