import { Box, Typography } from "@mui/material";
import type { SkuMappingCandidate } from "../../api/supplierSkuMappingApi";
import { formatAttributes, formatIdentity } from "../../lib/wooProductDisplay";

type Props = {
  product: Pick<SkuMappingCandidate, "id" | "sku" | "status" | "name" | "attributes">;
  testId?: string;
};

/** Three lines: product name, variation attributes (term names), then id / Woo SKU / status in smaller text. */
export default function WooProductLabel({ product, testId }: Props) {
  const attributes = formatAttributes(product);
  return (
    <Box data-testid={testId}>
      <Typography variant="body2" sx={{ fontWeight: 600 }} data-testid="woo-product-name">
        {product.name}
      </Typography>
      {attributes ? (
        <Typography variant="body2" data-testid="woo-product-attributes">
          {attributes}
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} data-testid="woo-product-identity">
        {formatIdentity(product)}
      </Typography>
    </Box>
  );
}
