import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ProductSearchAutocomplete from "./ProductSearchAutocomplete";
import type { ProductSearchResult } from "../api/productsApi";
import { ApiRequestError } from "../api/httpClient";
import {
  previewProductSubstitution,
  substituteProduct,
  type ProductSubstitutionPreview,
} from "../api/productSubstitutionApi";

export type PackingSubstitutionLine = {
  remaining_quantity?: number;
  qty?: number;
  fulfilled_quantity?: number;
  is_bundle_parent?: boolean;
  bundle_cart_key?: string;
  bundled_by?: string;
};

type Props = {
  orderId: number;
  orderItemId: number;
  currentSku: string;
  remainingQuantity: number;
  productName?: string;
  onApplied: () => void;
};

const isVariableParentProduct = (product: ProductSearchResult) => product.type === "variable";

const variableParentMessage = (skuOrName: string) =>
  `${skuOrName} is a variable parent product. Select the specific variation SKU.`;

export function canSubstitutePackingLine(line: PackingSubstitutionLine): boolean {
  const remaining = Number(line.remaining_quantity ?? line.qty ?? 0);
  const fulfilled = Number(line.fulfilled_quantity ?? 0);
  const isParentBundle = !!line.is_bundle_parent || (!!line.bundle_cart_key && !line.bundled_by);
  return remaining > 0 && fulfilled === 0 && !isParentBundle;
}

function formatStock(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Product substitution failed.";
}

export default function PackingProductSubstitution({
  orderId,
  orderItemId,
  currentSku,
  remainingQuantity,
  productName,
  onApplied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [preview, setPreview] = useState<ProductSubstitutionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number(quantity);
  const quantityIsValid = quantity !== "" && Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const selectedVariableParent = product ? isVariableParentProduct(product) : false;

  const resetForm = () => {
    setProduct(null);
    setQuantity("");
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
  };

  const closeForm = () => {
    if (submitting) return;
    setOpen(false);
    resetForm();
  };

  useEffect(() => {
    if (!open || !product || selectedVariableParent || !quantityIsValid) {
      setPreview(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      previewProductSubstitution({
        order_id: orderId,
        order_item_id: orderItemId,
        replacement_product_id: product.id,
        new_quantity: parsedQuantity,
      })
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
            setPreviewError(null);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreview(null);
            setPreviewError(errorMessage(error));
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, orderId, orderItemId, parsedQuantity, product, quantityIsValid, selectedVariableParent]);

  const confirm = async () => {
    if (!product || !quantityIsValid || selectedVariableParent || !preview) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await substituteProduct({
        order_id: orderId,
        order_item_id: orderItemId,
        replacement_product_id: product.id,
        new_quantity: parsedQuantity,
      });
      setOpen(false);
      resetForm();
      onApplied();
    } catch (error: unknown) {
      const body = error instanceof ApiRequestError ? error.responseBody : null;
      const detail = body && typeof body === "object" && "detail" in body ? (body as { detail?: { substitution_applied?: boolean } }).detail : null;
      if (detail?.substitution_applied) {
        onApplied();
      }
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip title="Replace SKU">
        <IconButton
          size="small"
          color="primary"
          aria-label="Replace SKU"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          sx={{
            width: 22,
            height: 22,
            p: 0,
            border: 1,
            borderColor: "primary.main",
            fontSize: "0.75rem",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          R
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={closeForm} fullWidth maxWidth="sm" onClick={(event) => event.stopPropagation()}>
        <DialogTitle>Replace SKU</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Stack spacing={0.25}>
              <Typography variant="body2" fontWeight={700}>
                Order #{orderId} · line {orderItemId}
              </Typography>
              <Typography variant="body2">
                {remainingQuantity} x {currentSku || "current SKU"}
                {productName ? ` — ${productName}` : ""}
              </Typography>
            </Stack>
            <ProductSearchAutocomplete
              id={`product-substitution-${orderItemId}`}
              value={product}
              label="Replacement SKU"
              onChange={(next) => {
                setProduct(next);
                setPreview(null);
                setPreviewError(null);
                setSubmitError(null);
              }}
              isOptionDisabled={isVariableParentProduct}
              formatOptionLabel={(option) =>
                `${option.sku ? `[${option.sku}] ` : ""}${option.name}${isVariableParentProduct(option) ? " (parent product - choose a variation SKU)" : ""}`
              }
            />
            {selectedVariableParent && product && (
              <Alert severity="warning">{variableParentMessage(product.sku || product.name)}</Alert>
            )}
            <TextField
              size="small"
              label="New quantity"
              type="number"
              value={quantity}
              inputProps={{ min: 1, step: 1 }}
              onChange={(event) => {
                setQuantity(event.target.value);
                setPreview(null);
                setPreviewError(null);
              }}
            />
            {previewError && <Alert severity="error">{previewError}</Alert>}
            {preview && (
              <Alert severity="info">
                <Typography variant="body2">
                  Stock: {preview.old_sku} {formatStock(preview.old_stock_before)} to {formatStock(preview.old_stock_after)}; {preview.new_sku} {formatStock(preview.new_stock_before)} to {formatStock(preview.new_stock_after)}.
                </Typography>
                <Typography variant="body2">
                  Price difference {preview.price_difference} {preview.currency} including GST. Refund is manual.
                </Typography>
                <Typography variant="body2">
                  Paid line total {preview.line_total} and tax {preview.line_tax} stay unchanged. Shipment {preview.shipment_tracking || "none"} is left unchanged.
                </Typography>
              </Alert>
            )}
            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={closeForm} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={confirm}
            disabled={!preview || submitting || selectedVariableParent}
          >
            Confirm substitution
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
