import { describe, expect, it } from "vitest";
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";
import { mergePurchaseOrderLinesWithSupplierDefaults } from "./addToPurchaseOrder";
import {
  applySupplierValuesToLine,
  applySupplierValuesToNewLines,
  supplierCurrencyMismatchMessage,
  type SupplierDefaultsContext,
  type SupplierDefaultsInput,
} from "./purchaseOrderSupplierDefaults";

const usdContext: SupplierDefaultsContext = { supplierId: 2, poCurrency: "USD", supplierDefaultCurrency: "USD", rate: 1.5 };

function blankLine(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    product_id: 501,
    sku: "GS-PLANTER-3-BA-SNOW",
    product_name: "Planter",
    qty: 4,
    supplier_sku: "",
    supplier_unit_price: 0,
    unit_price_aud: 0,
    supplier_total: 0,
    total_aud: 0,
    ...overrides,
  };
}

const item = { product_id: 501, supplier_id: 2, supplier_sku: "1-3T-CSN", supplier_price: "54.00" };

describe("applySupplierValuesToLine", () => {
  it("copies SKU and price, and derives totals and AUD, when supplier and currency match", () => {
    const { line, warning } = applySupplierValuesToLine(blankLine(), item, usdContext);
    expect(warning).toBeNull();
    expect(line).toMatchObject({
      sku: "GS-PLANTER-3-BA-SNOW",
      supplier_sku: "1-3T-CSN",
      supplier_unit_price: 54,
      supplier_total: 216,
      unit_price_aud: 81,
      total_aud: 324,
    });
  });

  it("copies nothing when the product belongs to a different supplier", () => {
    const result = applySupplierValuesToLine(blankLine(), { ...item, supplier_id: 7 }, usdContext);
    expect(result.line).toEqual(blankLine());
    expect(result.warning).toBeNull();
  });

  it("copies nothing when the PO has no supplier", () => {
    const result = applySupplierValuesToLine(blankLine(), item, { ...usdContext, supplierId: undefined });
    expect(result.line).toEqual(blankLine());
  });

  it("copies the SKU only and warns when PO currency differs from the supplier default", () => {
    const { line, warning } = applySupplierValuesToLine(blankLine(), item, { ...usdContext, poCurrency: "AUD" });
    expect(line.supplier_sku).toBe("1-3T-CSN");
    expect(line.supplier_unit_price).toBe(0);
    expect(line.supplier_total).toBe(0);
    expect(warning).toContain("GS-PLANTER-3-BA-SNOW");
    expect(warning).toContain("USD");
    expect(warning).toContain("AUD");
  });

  it("copies the SKU only and warns when the supplier has no default currency", () => {
    const { line, warning } = applySupplierValuesToLine(blankLine(), item, { ...usdContext, supplierDefaultCurrency: "" });
    expect(line.supplier_sku).toBe("1-3T-CSN");
    expect(line.supplier_unit_price).toBe(0);
    expect(warning).toContain("no default currency");
  });

  it("does not warn when the record has a SKU but no price", () => {
    const { line, warning } = applySupplierValuesToLine(blankLine(), { ...item, supplier_price: "" }, { ...usdContext, poCurrency: "AUD" });
    expect(line.supplier_sku).toBe("1-3T-CSN");
    expect(warning).toBeNull();
  });

  it("never overwrites values the user already entered", () => {
    const edited = blankLine({ supplier_sku: "MY-SKU", supplier_unit_price: 12, supplier_total: 48, unit_price_aud: 18, total_aud: 72 });
    const { line, warning } = applySupplierValuesToLine(edited, item, usdContext);
    expect(line).toEqual(edited);
    expect(warning).toBeNull();
  });

  it("fills a blank price without touching an SKU the user typed", () => {
    const { line } = applySupplierValuesToLine(blankLine({ supplier_sku: "MY-SKU" }), item, usdContext);
    expect(line.supplier_sku).toBe("MY-SKU");
    expect(line.supplier_unit_price).toBe(54);
  });

  it("matches currencies case-insensitively", () => {
    const { line } = applySupplierValuesToLine(blankLine(), item, { ...usdContext, poCurrency: "usd" });
    expect(line.supplier_unit_price).toBe(54);
  });
});

describe("supplierCurrencyMismatchMessage", () => {
  it("is empty without a supplier or when currencies agree", () => {
    expect(supplierCurrencyMismatchMessage({ ...usdContext, supplierId: undefined })).toBeNull();
    expect(supplierCurrencyMismatchMessage(usdContext)).toBeNull();
  });

  it("explains a mismatch", () => {
    expect(supplierCurrencyMismatchMessage({ ...usdContext, poCurrency: "AUD" })).toContain("USD");
  });
});

describe("applySupplierValuesToNewLines", () => {
  it("looks lines up by product id and collects warnings", () => {
    const input: SupplierDefaultsInput = { context: { ...usdContext, poCurrency: "AUD" }, items: [item] };
    const result = applySupplierValuesToNewLines([blankLine(), blankLine({ product_id: 999, sku: "OTHER" })], input);
    expect(result.lines[0].supplier_sku).toBe("1-3T-CSN");
    expect(result.lines[1].supplier_sku).toBe("");
    expect(result.warnings).toHaveLength(1);
  });

  it("returns the lines untouched with no input", () => {
    const lines = [blankLine()];
    expect(applySupplierValuesToNewLines(lines, undefined)).toEqual({ lines, warnings: [] });
  });
});

describe("mergePurchaseOrderLinesWithSupplierDefaults (Stock page / AddToPOModal path)", () => {
  const input: SupplierDefaultsInput = { context: usdContext, items: [item] };

  it("applies supplier values to new lines", () => {
    const { lines } = mergePurchaseOrderLinesWithSupplierDefaults(
      [],
      [{ product_id: 501, sku: "GS-PLANTER-3-BA-SNOW", product_name: "Planter", qty: 4 }],
      input,
    );
    expect(lines[0]).toMatchObject({ sku: "GS-PLANTER-3-BA-SNOW", supplier_sku: "1-3T-CSN", supplier_unit_price: 54, supplier_total: 216, total_aud: 324 });
  });

  it("leaves an existing line's values alone and only raises its qty", () => {
    const existing = blankLine({ id: 9, supplier_sku: "EDITED", supplier_unit_price: 10, supplier_total: 40 });
    const { lines } = mergePurchaseOrderLinesWithSupplierDefaults(
      [existing],
      [{ product_id: 501, sku: "GS-PLANTER-3-BA-SNOW", product_name: "Planter", qty: 2 }],
      input,
    );
    expect(lines).toEqual([{ ...existing, qty: 6 }]);
  });

  it("returns currency warnings for display", () => {
    const { lines, warnings } = mergePurchaseOrderLinesWithSupplierDefaults(
      [],
      [{ product_id: 501, sku: "GS-PLANTER-3-BA-SNOW", product_name: "Planter", qty: 1 }],
      { context: { ...usdContext, poCurrency: "AUD" }, items: [item] },
    );
    expect(lines[0].supplier_unit_price).toBe(0);
    expect(lines[0].supplier_sku).toBe("1-3T-CSN");
    expect(warnings).toHaveLength(1);
  });

  it("behaves exactly as before when no supplier defaults are supplied", () => {
    const { lines, warnings } = mergePurchaseOrderLinesWithSupplierDefaults(
      [],
      [{ product_id: 501, sku: "X", product_name: "Planter", qty: 1 }],
    );
    expect(lines[0].supplier_sku).toBe("");
    expect(warnings).toEqual([]);
  });
});
