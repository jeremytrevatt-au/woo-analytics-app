import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  CartOrderAddress,
  CartOrderCreateResponse,
  createCartOrder,
} from "../api/cartOrderApi";
import { createCoupon, CouponDiscountType } from "../api/couponApi";
import { ApiRequestError } from "../api/httpClient";
import {
  couponDialogInvalidReason,
  couponRestrictionEmail,
  defaultCouponExpiryLocal,
} from "../lib/couponEmail";
import { AuthoritativeCart } from "../types/cart";
import CartLineItems from "./CartLineItems";

type Props = {
  cart: AuthoritativeCart;
  conversationId?: string | null;
  restrictEmail?: string | null;
  customerName?: string | null;
};

type AddressForm = Required<
  Pick<
    CartOrderAddress,
    | "first_name"
    | "last_name"
    | "address_1"
    | "address_2"
    | "city"
    | "state"
    | "postcode"
    | "country"
    | "phone"
    | "email"
  >
>;

const EMPTY_ADDRESS: AddressForm = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "AU",
  phone: "",
  email: "",
};

export default function CreateOrderDialog({
  cart,
  conversationId,
  restrictEmail,
  customerName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [shippingInclusive, setShippingInclusive] = useState("");
  const [confirmConverted, setConfirmConverted] = useState(false);
  const [deliverViaChat, setDeliverViaChat] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(EMPTY_ADDRESS);
  const [shipping, setShipping] = useState<AddressForm>({ ...EMPTY_ADDRESS, email: "" });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [overrideAddress, setOverrideAddress] = useState(false);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [amount, setAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [emailRestriction, setEmailRestriction] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [couponIdempotencyKey, setCouponIdempotencyKey] = useState(() => crypto.randomUUID());
  const [orderIdempotencyKey, setOrderIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CartOrderCreateResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const isGuest = !cart.customer_id;
  const alreadyConverted = cart.status === "converted" || Boolean(cart.order_id);
  const hasChatIdentity = Boolean(
    conversationId || cart.cart_id || cart.visitor_id || cart.customer_id,
  );
  const knownEmail = couponRestrictionEmail(restrictEmail);

  useEffect(() => {
    if (!open) return;
    setDeliverViaChat(Boolean(conversationId) && hasChatIdentity);
    setError(null);
    setResult(null);
    setCopyStatus(null);
    setExpiresAt((current) => current || defaultCouponExpiryLocal());
    setEmailRestriction(knownEmail);
    setBilling((current) => ({
      ...current,
      email: current.email || knownEmail,
    }));
  }, [conversationId, hasChatIdentity, knownEmail, open]);

  const couponCreateInvalid = useMemo(
    () => couponDialogInvalidReason({
      code: newCouponCode,
      amount,
      discountType,
      usageLimit,
      expiresAt,
      freeShipping,
      emailRestriction,
    }),
    [amount, discountType, emailRestriction, expiresAt, freeShipping, newCouponCode, usageLimit],
  );

  const requireAddressForm = isGuest || overrideAddress;

  const guestInvalid = useMemo(() => {
    if (!requireAddressForm) return null;
    const billingMissing = incompleteAddress(billing, true);
    if (billingMissing) return `Billing: ${billingMissing}`;
    if (!sameAsBilling) {
      const shippingMissing = incompleteAddress(shipping, false);
      if (shippingMissing) return `Shipping: ${shippingMissing}`;
    }
    return null;
  }, [billing, requireAddressForm, sameAsBilling, shipping]);

  const createDisabledReason = useMemo(() => {
    if (cart.lines.length === 0) return "Cart has no lines.";
    if (alreadyConverted && !confirmConverted) {
      return "Confirm creating another order for this already-converted cart.";
    }
    if (guestInvalid) return guestInvalid;
    if (shippingInclusive.trim() !== "") {
      const value = Number(shippingInclusive);
      if (!Number.isFinite(value) || value < 0) return "Custom shipping must be zero or more.";
    }
    return null;
  }, [alreadyConverted, cart.lines.length, confirmConverted, guestInvalid, shippingInclusive]);

  const handleCreateCouponThenApply = async () => {
    if (couponCreateInvalid) {
      setError(couponCreateInvalid);
      return;
    }
    setCreatingCoupon(true);
    setError(null);
    try {
      const typedEmail = emailRestriction.trim();
      const response = await createCoupon(
        {
          code: newCouponCode.trim(),
          discount_type: discountType,
          usage_limit: Number(usageLimit),
          expires_at: new Date(expiresAt).toISOString(),
          customer_id: cart.customer_id || undefined,
          cart_id: cart.cart_id,
          visitor_id: cart.visitor_id,
          conversation_id: conversationId || undefined,
          deliver_via_chat: false,
          free_shipping: freeShipping,
          email_restrictions: typedEmail || undefined,
          ...(amount.trim() === "" ? {} : { amount: Number(amount) }),
        },
        couponIdempotencyKey,
      );
      setCouponCode(response.code);
      setShowCreateCoupon(false);
      setCouponIdempotencyKey(crypto.randomUUID());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleCreateOrder = async () => {
    if (createDisabledReason) {
      setError(createDisabledReason);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        coupon_code: couponCode.trim() || undefined,
        custom_shipping_inclusive:
          shippingInclusive.trim() === "" ? undefined : Number(shippingInclusive),
        confirm_already_converted: alreadyConverted ? confirmConverted : undefined,
        deliver_via_chat: Boolean(conversationId) && deliverViaChat,
        conversation_id: conversationId || undefined,
        visitor_id: cart.visitor_id || undefined,
        customer_id: cart.customer_id || undefined,
        ...(requireAddressForm
          ? {
              billing: addressPayload(billing, true),
              shipping: addressPayload(sameAsBilling ? billing : shipping, false),
            }
          : {}),
      };
      const response = await createCartOrder(cart.cart_id, payload, orderIdempotencyKey);
      setResult(response);
    } catch (requestError) {
      if (
        requestError instanceof ApiRequestError
        && requestError.status === 409
        && alreadyConverted
        && !confirmConverted
      ) {
        setError(
          requestError.message
            || "Cart is already converted. Confirm to create another pending order.",
        );
      } else {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPayLink = async () => {
    if (!result?.payment_url) return;
    try {
      await navigator.clipboard.writeText(result.payment_url);
      setCopyStatus("Pay link copied.");
    } catch {
      setCopyStatus("Could not copy automatically — select the pay link text.");
    }
  };

  const handleClose = () => {
    if (saving || creatingCoupon) return;
    setOpen(false);
    setCouponCode("");
    setShippingInclusive("");
    setConfirmConverted(false);
    setBilling(EMPTY_ADDRESS);
    setShipping({ ...EMPTY_ADDRESS, email: "" });
    setSameAsBilling(true);
    setOverrideAddress(false);
    setShowCreateCoupon(false);
    setNewCouponCode("");
    setAmount("");
    setUsageLimit("1");
    setExpiresAt("");
    setFreeShipping(false);
    setEmailRestriction("");
    setOrderIdempotencyKey(crypto.randomUUID());
    setCouponIdempotencyKey(crypto.randomUUID());
    setResult(null);
    setError(null);
    setCopyStatus(null);
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Create order
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
        <DialogTitle>Create pending WooCommerce order</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {result ? (
              <Stack spacing={1.5}>
                <Alert severity={deliverySeverity(result.chat_delivery.status)}>
                  <Typography variant="body2" fontWeight={700}>
                    Order #{result.order_number} created ({result.status}).
                  </Typography>
                  <Typography variant="body2">
                    Total {formatMoney(result.total, result.currency)}.
                    {" "}Fulfillment excluded until paid. Stock not reduced on create.
                  </Typography>
                  {typeof result.hold_stock_minutes === "number" && result.hold_stock_minutes > 0 ? (
                    <Typography variant="caption" display="block">
                      Store hold-stock is {result.hold_stock_minutes} minutes — pending orders may
                      reserve stock until that window expires.
                    </Typography>
                  ) : null}
                  <Typography variant="caption" display="block">
                    Chat delivery: {result.chat_delivery.status.replaceAll("_", " ")}
                    {result.chat_delivery.reason
                      ? ` — ${result.chat_delivery.reason.replaceAll("_", " ")}`
                      : ""}
                  </Typography>
                </Alert>
                <TextField
                  label="Customer pay link"
                  value={result.payment_url}
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="contained" onClick={() => void handleCopyPayLink()}>
                    Copy pay link
                  </Button>
                  <Button
                    component={Link}
                    href={result.admin_edit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                  >
                    Open admin order
                  </Button>
                </Stack>
                {copyStatus ? (
                  <Typography variant="caption" color="text.secondary">
                    {copyStatus}
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {customerName
                    ? `Creating from cart for ${customerName}.`
                    : "Creating from the authoritative WordPress cart."}
                  {" "}Prices recalculate live in WooCommerce. Cart discount totals are ignored
                  unless you apply a coupon.
                </Typography>
                <CartLineItems lines={cart.lines} currency={cart.currency} />
                {alreadyConverted ? (
                  <Alert severity="warning">
                    This cart is already linked to order
                    {cart.order_id ? ` #${cart.order_id}` : ""}. Creating another pending order
                    requires confirmation.
                    <FormControlLabel
                      sx={{ display: "block", mt: 1 }}
                      control={(
                        <Checkbox
                          checked={confirmConverted}
                          onChange={(event) => setConfirmConverted(event.target.checked)}
                        />
                      )}
                      label="Create another pending order anyway"
                    />
                  </Alert>
                ) : null}
                <TextField
                  label="Coupon code to apply"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  helperText="Optional. Apply an existing code, or create one below then apply."
                  inputProps={{ maxLength: 64 }}
                />
                <Button
                  size="small"
                  onClick={() => setShowCreateCoupon((current) => !current)}
                >
                  {showCreateCoupon ? "Hide create coupon" : "Create coupon then apply"}
                </Button>
                <Collapse in={showCreateCoupon}>
                  <Stack spacing={2} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
                    <TextField
                      label="Unique coupon code"
                      value={newCouponCode}
                      onChange={(event) => setNewCouponCode(event.target.value.toUpperCase())}
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
                        inputProps={{
                          min: freeShipping ? 0 : 0.01,
                          max: discountType === "percent" ? 100 : undefined,
                          step: 0.01,
                        }}
                        required={!freeShipping}
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
                    />
                    <Button
                      variant="outlined"
                      onClick={() => void handleCreateCouponThenApply()}
                      disabled={creatingCoupon || Boolean(couponCreateInvalid)}
                    >
                      {creatingCoupon ? "Creating coupon…" : "Create coupon and fill apply field"}
                    </Button>
                  </Stack>
                </Collapse>
                <TextField
                  label={`Custom shipping (${cart.currency}, GST-inclusive)`}
                  type="number"
                  value={shippingInclusive}
                  onChange={(event) => setShippingInclusive(event.target.value)}
                  helperText="Optional. Added as a taxable fee line, not a shipping method."
                  inputProps={{ min: 0, step: 0.01 }}
                />
                {!isGuest ? (
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={overrideAddress}
                        onChange={(event) => setOverrideAddress(event.target.checked)}
                      />
                    )}
                    label="Override billing/shipping address on this order"
                  />
                ) : null}
                {requireAddressForm ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      {isGuest ? "Guest billing address (required)" : "Billing address"}
                    </Typography>
                    <AddressFields
                      value={billing}
                      onChange={setBilling}
                      includeEmail
                    />
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={sameAsBilling}
                          onChange={(event) => setSameAsBilling(event.target.checked)}
                        />
                      )}
                      label="Shipping same as billing"
                    />
                    {!sameAsBilling ? (
                      <>
                        <Typography variant="subtitle2">Shipping address</Typography>
                        <AddressFields
                          value={shipping}
                          onChange={setShipping}
                          includeEmail={false}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
                {conversationId ? (
                  <FormControlLabel
                    control={(
                      <Checkbox
                        checked={deliverViaChat}
                        onChange={(event) => setDeliverViaChat(event.target.checked)}
                      />
                    )}
                    label="Insert pay link into the conversation (operator-visible)"
                  />
                ) : (
                  <Alert severity="info">
                    Opened outside Chat Inbox — copy the pay link after create. Auto-insert requires
                    a conversation.
                  </Alert>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {!result && createDisabledReason ? (
            <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 2 }}>
              {createDisabledReason}
            </Typography>
          ) : null}
          <Button onClick={handleClose}>{result ? "Close" : "Cancel"}</Button>
          {!result ? (
            <Button
              variant="contained"
              onClick={() => void handleCreateOrder()}
              disabled={saving || Boolean(createDisabledReason)}
            >
              {saving ? "Creating…" : "Create pending order"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
}

function AddressFields({
  value,
  onChange,
  includeEmail,
}: {
  value: AddressForm;
  onChange: (next: AddressForm) => void;
  includeEmail: boolean;
}) {
  const set = (field: keyof AddressForm) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: event.target.value });
  };
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth required label="First name" value={value.first_name} onChange={set("first_name")} />
        <TextField fullWidth required label="Last name" value={value.last_name} onChange={set("last_name")} />
      </Stack>
      {includeEmail ? (
        <TextField
          fullWidth
          required
          label="Email"
          type="email"
          value={value.email}
          onChange={set("email")}
        />
      ) : null}
      <TextField fullWidth required label="Address line 1" value={value.address_1} onChange={set("address_1")} />
      <TextField fullWidth label="Address line 2" value={value.address_2} onChange={set("address_2")} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField fullWidth required label="City" value={value.city} onChange={set("city")} />
        <TextField fullWidth label="State" value={value.state} onChange={set("state")} />
        <TextField fullWidth required label="Postcode" value={value.postcode} onChange={set("postcode")} />
        <TextField fullWidth required label="Country" value={value.country} onChange={set("country")} inputProps={{ maxLength: 2 }} />
      </Stack>
      <TextField fullWidth label="Phone" value={value.phone} onChange={set("phone")} />
    </Stack>
  );
}

function incompleteAddress(address: AddressForm, requireEmail: boolean): string | null {
  for (const field of ["first_name", "last_name", "address_1", "city", "postcode", "country"] as const) {
    if (!address[field].trim()) return `${field.replaceAll("_", " ")} is required.`;
  }
  if (requireEmail && !couponRestrictionEmail(address.email)) {
    return "a valid email is required.";
  }
  return null;
}

function addressPayload(address: AddressForm, includeEmail: boolean): CartOrderAddress {
  const payload: CartOrderAddress = {
    first_name: address.first_name.trim(),
    last_name: address.last_name.trim(),
    address_1: address.address_1.trim(),
    address_2: address.address_2.trim() || undefined,
    city: address.city.trim(),
    state: address.state.trim() || undefined,
    postcode: address.postcode.trim(),
    country: address.country.trim().toUpperCase(),
    phone: address.phone.trim() || undefined,
  };
  if (includeEmail) {
    payload.email = address.email.trim();
  }
  return payload;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "AUD" }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function deliverySeverity(
  status: CartOrderCreateResponse["chat_delivery"]["status"],
): "success" | "info" | "warning" | "error" {
  if (status === "delivered") return "success";
  if (status === "not_requested") return "info";
  if (status === "unavailable") return "warning";
  return "error";
}
