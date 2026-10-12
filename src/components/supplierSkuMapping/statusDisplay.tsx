import { Chip } from "@mui/material";
import type { SkuMappingCandidate, SkuMappingStatus } from "../../api/supplierSkuMappingApi";
import { STATUS_LABELS } from "../../lib/supplierSkuMapping";

type ChipColor = "default" | "success" | "warning" | "error" | "info" | "primary";

export const STATUS_COLORS: Record<SkuMappingStatus, ChipColor> = {
  match: "success",
  unchanged: "default",
  conflict: "warning",
  blocked: "error",
  unmapped: "error",
  no_woo_product: "default",
  ambiguous: "error",
  price_tbd: "warning",
  sheet_warning: "warning",
  woo_disabled: "info",
};

export const FLAG_LABELS: Record<string, string> = {
  retiring: "Retiring",
  limited_edition: "Limited edition",
  out_of_stock: "Out of stock",
  woo_disabled: "Woo disabled",
  stray_bracket_stripped: "Stray [ removed",
};

export function StatusChip({ status }: { status: SkuMappingStatus }) {
  return <Chip size="small" color={STATUS_COLORS[status]} label={STATUS_LABELS[status]} data-testid={`status-${status}`} />;
}

export function formatCurrentSupplierValues(candidate: SkuMappingCandidate | null): string {
  if (!candidate) return "";
  const parts: string[] = [];
  if (candidate.supplier_id !== null && candidate.supplier_id !== undefined) parts.push(`supplier ${candidate.supplier_id}`);
  if (candidate.supplier_sku) parts.push(candidate.supplier_sku);
  if (candidate.supplier_price) parts.push(`$${candidate.supplier_price}`);
  return parts.length > 0 ? parts.join(" / ") : "empty";
}

export function wooStatusLabel(status: string): string {
  if (status === "publish") return "published";
  return status;
}
