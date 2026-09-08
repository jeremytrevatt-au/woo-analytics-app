import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

export type PackingAttribute = {
  label: string;
  value: string;
};

export type ParsedPackingProduct = {
  productName: string;
  attributes: PackingAttribute[];
};

const colourSwatches: Record<string, string> = {
  black: "#111111",
  blue: "#1976d2",
  brown: "#795548",
  clear: "#e0f7fa",
  cream: "#fff8e1",
  green: "#2e7d32",
  grey: "#9e9e9e",
  gray: "#9e9e9e",
  orange: "#f57c00",
  pink: "#ec407a",
  purple: "#7b1fa2",
  red: "#d32f2f",
  silver: "#b0bec5",
  stone: "#aaa59a",
  white: "#ffffff",
  yellow: "#fbc02d",
};

export function parsePackingProduct(description: string): ParsedPackingProduct {
  const source = String(description || "").trim();
  const attributeSeparator = source.search(/\s+-\s+(?=[^,:]+:\s*)/);

  if (attributeSeparator < 0) {
    return { productName: source, attributes: [] };
  }

  const productName = source.slice(0, attributeSeparator).trim();
  const attributeText = source
    .slice(attributeSeparator)
    .replace(/^\s+-\s+/, "")
    .trim();

  const attributes = attributeText
    .split(/,\s*(?=[^,:]+:\s*)/)
    .map((part) => {
      const colonIndex = part.indexOf(":");
      if (colonIndex < 0) return null;

      const label = part.slice(0, colonIndex).trim();
      const value = part.slice(colonIndex + 1).trim();
      return label && value ? { label, value } : null;
    })
    .filter((attribute): attribute is PackingAttribute => attribute !== null);

  return { productName: productName || source, attributes };
}

export function findPackingColourSwatch(attribute: PackingAttribute): string | null {
  if (!/colou?r/i.test(attribute.label)) return null;

  const valueTokens = attribute.value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const colourKey = Object.keys(colourSwatches).find((key) => valueTokens.includes(key));
  return colourKey ? colourSwatches[colourKey] : null;
}

type PackingLineDetailsProps = {
  description: string;
  quantity: number | string;
  sku: string;
  skuActions?: ReactNode;
};

function PackingLineDetails({ description, quantity, sku, skuActions }: PackingLineDetailsProps) {
  const parsed = parsePackingProduct(description);

  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
        {parsed.productName}
      </Typography>
      {parsed.attributes.map((attribute, index) => {
        const swatchColour = findPackingColourSwatch(attribute);
        return (
          <Stack
            key={`${attribute.label}:${index}`}
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
              {index < parsed.attributes.length - 1 ? "," : ""}
            </Typography>
          </Stack>
        );
      })}
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 0.25 }}>
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          <Box component="span" fontWeight={700}>
            SKU:
          </Box>{" "}
          {quantity}x {sku}
        </Typography>
        {skuActions}
      </Stack>
    </Stack>
  );
}

export default PackingLineDetails;
