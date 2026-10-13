import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
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

export default function PackingProductSubstitution({ orderId, orderItemId, onApplied }: Props) {
  const [product, setProduct] = useState<ProductSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [preview, setPreview] = useState<ProductSubstitutionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number(quantity);
  const quantityIsValid = quantity !== "" && Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const selectedVariableParent = product ? isVariableParentProduct(product) : false;

  useEffect(() => {
    if (!product || selectedVariableParent || !quantityIsValid) {
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
  }, [orderId, orderItemId, parsedQuantity, product, quantityIsValid, selectedVariableParent]);

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
    <Box sx={{ mt: 1 }} onClick={(event) => event.stopPropagation()}>
      <Stack spacing={1}>
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
        <Button
          variant="contained"
          size="small"
          onClick={confirm}
          disabled={!preview || submitting || selectedVariableParent}
        >
          Confirm substitution
        </Button>
      </Stack>
    </Box>
  );
}
