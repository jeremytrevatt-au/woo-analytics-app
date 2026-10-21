import { Box, Chip, Stack, Typography } from "@mui/material";
import { nestCartLines } from "../lib/cartLineNesting";
import { CartLine } from "../types/cart";
import {
  findPackingColourSwatch,
  parsePackingProduct,
} from "./PackingLineDetails";

type Props = {
  lines: CartLine[];
  currency: string;
};

export default function CartLineItems({ lines, currency }: Props) {
  if (lines.length === 0) {
    return (
      <Typography color="text.secondary">This cart has no line items.</Typography>
    );
  }

  const nested = nestCartLines(lines);

  return (
    <Box aria-label="Cart line items">
      {nested.map((item, idx) => {
        const { line, isParentBundle, isChildItem } = item;
        const parsed = parsePackingProduct(line.product_name);
        return (
          <Box
            key={line.id ?? `${line.product_id}-${line.variation_id}-${idx}`}
            data-cart-line-role={item.role}
            sx={{
              mb: 1,
              pb: 1,
              borderBottom: idx < nested.length - 1 ? "1px dashed" : "none",
              borderColor: "divider",
              bgcolor: isParentBundle ? "action.hover" : "transparent",
              borderRadius: isParentBundle ? 1 : 0,
              py: isParentBundle ? 1 : 0,
            }}
          >
            <Box
              sx={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "minmax(0, 1fr) 120px",
                },
                columnGap: 1,
                rowGap: 1,
                alignItems: "start",
              }}
            >
              <Box
                sx={{
                  minWidth: 0,
                  gridColumn: { xs: "1 / -1", sm: "1" },
                  pl: isChildItem ? 4 : isParentBundle ? 1 : 0,
                  borderLeft: isChildItem ? "2px solid" : "none",
                  borderLeftColor: "primary.light",
                }}
              >
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                      {line.quantity} x {parsed.productName}
                    </Typography>
                    {isParentBundle ? (
                      <Chip
                        size="small"
                        label="Bundle"
                        color="primary"
                        variant="outlined"
                        sx={{ height: "20px", fontSize: "0.7rem" }}
                      />
                    ) : null}
                  </Stack>
                  {parsed.attributes.map((attribute, attributeIndex) => {
                    const swatchColour = findPackingColourSwatch(attribute);
                    return (
                      <Stack
                        key={`${attribute.label}:${attributeIndex}`}
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        {swatchColour ? (
                          <Box
                            role="img"
                            aria-label={`${attribute.value} colour swatch`}
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: 0.75,
                              bgcolor: swatchColour,
                              border: "1px solid",
                              borderColor: swatchColour === "#ffffff" ? "grey.400" : "transparent",
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          <Box component="span" fontWeight={700} color="text.primary">
                            {attribute.label}:
                          </Box>{" "}
                          {attribute.value}
                          {attributeIndex < parsed.attributes.length - 1 ? "," : ""}
                        </Typography>
                      </Stack>
                    );
                  })}
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ pt: 0.25 }}
                  >
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      <Box component="span" fontWeight={700}>
                        SKU:
                      </Box>{" "}
                      {line.sku || "—"}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
              <Box
                sx={{
                  gridColumn: { xs: "1 / -1", sm: "2" },
                  justifySelf: { sm: "end" },
                  textAlign: { sm: "right" },
                }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {formatMoney(line.line_total, currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Unit {formatMoney(line.unit_total, currency)}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "AUD",
  }).format(Number(value));
}
