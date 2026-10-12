/**
 * Display text for a WooCommerce product on the Supplier SKU Mapping page.
 * Line 1: product name (the parent's name for a variation). Line 2: variation attributes by term name.
 * Line 3: id, Woo SKU and status.
 */
import type { SkuMappingCandidate } from "../api/supplierSkuMappingApi";

type ProductRef = Pick<SkuMappingCandidate, "id" | "sku" | "status" | "name" | "attributes">;

export function wooStatusText(status: string): string {
  return status === "publish" ? "published" : status;
}

/** "Tier: 3 Tier, Style: Basic, Colour: Stunning Stone". Empty for a simple product. A blank term shows as "Any". */
export function formatAttributes(product: Pick<SkuMappingCandidate, "attributes">): string {
  return (product.attributes ?? [])
    .map((attribute) => `${attribute.name}: ${attribute.term_name ? attribute.term_name : "Any"}`)
    .join(", ");
}

/** "#123 / GS-SKU / published". */
export function formatIdentity(product: Pick<SkuMappingCandidate, "id" | "sku" | "status">): string {
  return `#${product.id} / ${product.sku || "(no SKU)"} / ${wooStatusText(product.status)}`;
}

/** Single-line text for places that cannot show three lines (search, select options, accessible names). */
export function formatProductOneLine(product: ProductRef): string {
  const attributes = formatAttributes(product);
  return [product.name, attributes, formatIdentity(product)].filter(Boolean).join(" - ");
}
