/**
 * Purchase Order Auto Order recommended qty.
 *
 * Formula:
 *   D = daily demand
 *   L = lead time days
 *   C = days of cover required (dialog)
 *   S = current stock_qty (on-hand)
 *   B = backordered_qty or 0
 *   P = preordered_qty or 0
 *
 *   recommended = ceil(max(0, D * (L + C) - S + B + P))
 *
 * Special cases:
 *   If D is 0 and (B + P) > 0, recommended = B + P (cover outstanding orders only; do not subtract S).
 *   If D is 0 and B + P is 0, recommended = 0.
 *
 * D resolution (do not invent demand):
 *   1. Prefer stock-forecast avg_daily_usage when that field is present (finite, >= 0).
 *   2. Else if days_of_cover > 0, D = stock_qty / days_of_cover.
 *   3. Else D = 0. (If days_of_cover is 0/null and stock is 0, forecast was already checked in step 1.)
 *
 * L resolution:
 *   1. Line effective_lead_time_days when present and > 0 (product / stock forecast).
 *   2. PO header lead_time_days when present and > 0.
 *   3. Supplier default_lead_time_days when present and > 0.
 *   4. If still missing and the PO supplier is GreenStalk, L = 71.
 *   5. Otherwise L = 0. Do not invent 71 for other suppliers.
 */
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";

export const GREENSTALK_DEFAULT_LEAD_TIME_DAYS = 71;
export const AUTO_ORDER_LOG_EVENT = "po_auto_order";

const SESSION_DAYS_KEY = "po_auto_order_days_of_cover";

export type AutoOrderLeadTimeSource = {
  lineLeadTimeDays?: number | null;
  poLeadTimeDays?: number | null;
  supplierLeadTimeDays?: number | null;
  supplierName?: string | null;
};

export type AutoOrderLineInput = {
  sku?: string | null;
  id?: number | string;
  product_id?: number;
  stock_qty?: number | null;
  days_of_cover?: number | null;
  avg_daily_usage?: number | null;
  backordered_qty?: number | null;
  preordered_qty?: number | null;
  effective_lead_time_days?: number | null;
};

export type AutoOrderLineResult = {
  index: number;
  key: string;
  sku: string;
  D: number;
  L: number;
  C: number;
  S: number;
  B: number;
  P: number;
  recommended: number;
  isAutoOrdered: boolean;
};

export function toFiniteNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDaysOfCoverRequired(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function isGreenStalkSupplier(name?: string | null): boolean {
  return (name || "").toLowerCase().includes("greenstalk");
}

export function getSessionDaysOfCoverRequired(): number | null {
  try {
    const raw = sessionStorage.getItem(SESSION_DAYS_KEY);
    return raw ? parseDaysOfCoverRequired(raw) : null;
  } catch {
    return null;
  }
}

export function setSessionDaysOfCoverRequired(days: number): void {
  try {
    sessionStorage.setItem(SESSION_DAYS_KEY, String(days));
  } catch {
    // Session memory is optional; calculation still runs from the dialog value.
  }
}

export function autoOrderLineKey(
  line: Pick<AutoOrderLineInput, "id" | "product_id" | "sku">,
  index: number,
): string {
  if (line.id !== undefined && line.id !== null && String(line.id) !== "") {
    return `id:${line.id}`;
  }
  return `idx:${index}:p:${line.product_id ?? 0}:sku:${line.sku ?? ""}`;
}

/**
 * Daily demand D. Prefer forecast avg_daily_usage. Never invent a velocity.
 */
export function resolveDailyDemand(line: AutoOrderLineInput): number {
  const forecast = toFiniteNumber(line.avg_daily_usage);
  if (forecast !== null && forecast >= 0) {
    return forecast;
  }

  const daysOfCover = toFiniteNumber(line.days_of_cover);
  const stock = toFiniteNumber(line.stock_qty) ?? 0;
  if (daysOfCover !== null && daysOfCover > 0) {
    return stock / daysOfCover;
  }

  return 0;
}

/**
 * Lead time L from product/PO/supplier payload, then GreenStalk 71 only when still missing.
 */
export function resolveLeadTimeDays(source: AutoOrderLeadTimeSource): number {
  const lineLead = toFiniteNumber(source.lineLeadTimeDays);
  if (lineLead !== null && lineLead > 0) return Math.trunc(lineLead);

  const poLead = toFiniteNumber(source.poLeadTimeDays);
  if (poLead !== null && poLead > 0) return Math.trunc(poLead);

  const supplierLead = toFiniteNumber(source.supplierLeadTimeDays);
  if (supplierLead !== null && supplierLead > 0) return Math.trunc(supplierLead);

  if (isGreenStalkSupplier(source.supplierName)) {
    return GREENSTALK_DEFAULT_LEAD_TIME_DAYS;
  }

  return 0;
}

export function recommendedAutoOrderQty(params: {
  dailyDemand: number;
  leadTimeDays: number;
  daysOfCoverRequired: number;
  stockQty: number;
  backorderedQty: number;
  preorderedQty: number;
}): number {
  const D = Number.isFinite(params.dailyDemand) && params.dailyDemand > 0 ? params.dailyDemand : 0;
  const L = Number.isFinite(params.leadTimeDays) && params.leadTimeDays > 0 ? params.leadTimeDays : 0;
  const C = Number.isFinite(params.daysOfCoverRequired) && params.daysOfCoverRequired > 0
    ? params.daysOfCoverRequired
    : 0;
  const S = Number.isFinite(params.stockQty) ? params.stockQty : 0;
  const B = Number.isFinite(params.backorderedQty) && params.backorderedQty > 0 ? params.backorderedQty : 0;
  const P = Number.isFinite(params.preorderedQty) && params.preorderedQty > 0 ? params.preorderedQty : 0;

  if (D === 0) {
    return Math.ceil(B + P);
  }

  return Math.ceil(Math.max(0, D * (L + C) - S + B + P));
}

export function computeAutoOrderForLine(
  line: AutoOrderLineInput,
  index: number,
  daysOfCoverRequired: number,
  leadSource: Omit<AutoOrderLeadTimeSource, "lineLeadTimeDays">,
): AutoOrderLineResult {
  const D = resolveDailyDemand(line);
  const L = resolveLeadTimeDays({
    ...leadSource,
    lineLeadTimeDays: line.effective_lead_time_days,
  });
  const S = toFiniteNumber(line.stock_qty) ?? 0;
  const B = toFiniteNumber(line.backordered_qty) ?? 0;
  const P = toFiniteNumber(line.preordered_qty) ?? 0;
  const recommended = recommendedAutoOrderQty({
    dailyDemand: D,
    leadTimeDays: L,
    daysOfCoverRequired,
    stockQty: S,
    backorderedQty: B,
    preorderedQty: P,
  });

  return {
    index,
    key: autoOrderLineKey(line, index),
    sku: line.sku || "",
    D,
    L,
    C: daysOfCoverRequired,
    S,
    B,
    P,
    recommended,
    isAutoOrdered: recommended > 0,
  };
}

export function computeAutoOrderForLines(
  lines: PurchaseOrderLine[],
  daysOfCoverRequired: number,
  leadSource: Omit<AutoOrderLeadTimeSource, "lineLeadTimeDays">,
): AutoOrderLineResult[] {
  return lines.map((line, index) =>
    computeAutoOrderForLine(line, index, daysOfCoverRequired, leadSource),
  );
}

/** Cloud-friendly structured log. SKU only — no product names or other PII. */
export function logAutoOrderRecommendation(result: AutoOrderLineResult): void {
  console.info(AUTO_ORDER_LOG_EVENT, {
    sku: result.sku,
    D: result.D,
    L: result.L,
    C: result.C,
    S: result.S,
    B: result.B,
    P: result.P,
    recommended: result.recommended,
  });
}
