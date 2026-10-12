/**
 * Supplier SKU / Supplier price defaults for purchase order lines.
 *
 * When a product is added to a PO, the Supplier SKU and Supplier price held on the Woo product record
 * (set through Supplier SKU Mapping) are copied onto the new line, with these rules:
 *  1. Only when the product's supplier is the PO's supplier.
 *  2. The price is copied only when the PO currency equals the supplier's default currency. Otherwise the
 *     SKU is copied and a visible warning explains that the price was not.
 *  3. Values the user already entered on a line are never overwritten (only blank SKU / zero price are filled).
 * The line `sku` stays the Woo SKU. AUD values come from the PO conversion rate.
 *
 * One helper serves both PurchaseOrderModal (search and add) and lib/addToPurchaseOrder (Stock page / AddToPOModal).
 */
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";
import { supplierSkuMappingApi, type SupplierSkuLookupItem } from "../api/supplierSkuMappingApi";

export type SupplierDefaultsContext = {
  /** The PO's supplier. Without one nothing is copied. */
  supplierId: number | null | undefined;
  /** supplier_currency on the PO. */
  poCurrency: string | null | undefined;
  /** default_currency on the supplier record. */
  supplierDefaultCurrency: string | null | undefined;
  /** PO currency_conversion_rate (supplier currency -> AUD). */
  rate: number;
};

export type SupplierDefaultsInput = {
  context: SupplierDefaultsContext;
  items: SupplierSkuLookupItem[];
};

export type LineDefaultsResult = {
  line: PurchaseOrderLine;
  warning: string | null;
};

const roundMoney = (value: number) => parseFloat(value.toFixed(2));

function sameCurrency(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || "").trim().toUpperCase();
  const right = (b || "").trim().toUpperCase();
  return Boolean(left) && Boolean(right) && left === right;
}

function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Standing warning for a PO whose currency differs from its supplier's default currency. */
export function supplierCurrencyMismatchMessage(context: SupplierDefaultsContext): string | null {
  if (!context.supplierId) return null;
  if (!context.supplierDefaultCurrency) {
    return "The supplier has no default currency set, so Supplier prices from product records are not copied onto lines.";
  }
  if (sameCurrency(context.poCurrency, context.supplierDefaultCurrency)) return null;
  return `This PO is in ${context.poCurrency || "no currency"} but the supplier's prices are held in ${context.supplierDefaultCurrency}. Supplier SKUs are copied onto new lines; Supplier prices are not.`;
}

export function applySupplierValuesToLine(
  line: PurchaseOrderLine,
  item: SupplierSkuLookupItem | undefined,
  context: SupplierDefaultsContext,
): LineDefaultsResult {
  if (!item || !context.supplierId || Number(item.supplier_id) !== Number(context.supplierId)) {
    return { line, warning: null };
  }

  let next = line;
  const recordSku = (item.supplier_sku || "").trim();
  if (recordSku && !String(line.supplier_sku || "").trim()) {
    next = { ...next, supplier_sku: recordSku };
  }

  const recordPrice = parsePrice(item.supplier_price);
  if (recordPrice === null) return { line: next, warning: null };

  const label = line.sku || line.product_name || `product ${line.product_id}`;
  if (!sameCurrency(context.poCurrency, context.supplierDefaultCurrency)) {
    const reason = context.supplierDefaultCurrency
      ? `the supplier's prices are held in ${context.supplierDefaultCurrency} but this PO is in ${context.poCurrency || "no currency"}`
      : "the supplier has no default currency set";
    return {
      line: next,
      warning: `${label}: Supplier price ${item.supplier_price} was not copied because ${reason}. The Supplier SKU was copied.`,
    };
  }

  const priceAlreadyEntered = Number(line.supplier_unit_price || 0) !== 0 || Number(line.supplier_total || 0) !== 0;
  if (priceAlreadyEntered) return { line: next, warning: null };

  const qty = Math.trunc(Number(line.qty) || 0);
  const supplierTotal = roundMoney(qty * recordPrice);
  const rate = Number.isFinite(context.rate) && context.rate > 0 ? context.rate : 1;
  next = {
    ...next,
    supplier_unit_price: recordPrice,
    supplier_total: supplierTotal,
    unit_price_aud: roundMoney(recordPrice * rate),
    total_aud: roundMoney(supplierTotal * rate),
  };
  return { line: next, warning: null };
}

/** Apply defaults to freshly created lines only, looking each one up by product id. */
export function applySupplierValuesToNewLines(
  newLines: PurchaseOrderLine[],
  input: SupplierDefaultsInput | undefined,
): { lines: PurchaseOrderLine[]; warnings: string[] } {
  if (!input) return { lines: newLines, warnings: [] };
  const byProduct = new Map(input.items.map((item) => [Number(item.product_id), item]));
  const warnings: string[] = [];
  const lines = newLines.map((line) => {
    const result = applySupplierValuesToLine(line, byProduct.get(Number(line.product_id)), input.context);
    if (result.warning) warnings.push(result.warning);
    return result.line;
  });
  return { lines, warnings };
}

/** Fetch what the Woo product records hold for this PO's supplier. */
export async function loadSupplierDefaults(params: {
  supplierId: number | null | undefined;
  poCurrency: string | null | undefined;
  rate: number;
  productIds: number[];
  supplierDefaultCurrency?: string | null;
}): Promise<SupplierDefaultsInput | undefined> {
  const productIds = Array.from(new Set(params.productIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (!params.supplierId || productIds.length === 0) return undefined;

  const lookup = await supplierSkuMappingApi.lookup(params.supplierId, productIds);
  return {
    context: {
      supplierId: params.supplierId,
      poCurrency: params.poCurrency,
      // The lookup returns the supplier's default_currency; an explicit value (already loaded by the caller) wins.
      supplierDefaultCurrency: params.supplierDefaultCurrency ?? lookup.default_currency,
      rate: params.rate,
    },
    items: lookup.items,
  };
}
