import { describe, expect, it } from "vitest";
import { compactSupplierSkuPreviewForDebug, describeRequestBodyForDebug } from "./supplierSkuPreviewDebug";

describe("compactSupplierSkuPreviewForDebug", () => {
  it("drops per-row candidate lists but keeps what is needed to refer to a row", () => {
    const body = {
      row_count: 1,
      totals: { match: 1 },
      candidates: new Array(900).fill({ id: 1 }),
      woo_without_supplier_row: [{ id: 2 }],
      rows: [
        {
          row_id: 7,
          supplier_sku: "1-3T-CSN",
          supplier_name: "3 Tier Basic",
          price: "54.00",
          status: "blocked",
          matched: { id: 5, sku: "GS-5", status: "publish", label: "long label", supplier_sku: "" },
          candidates: [{ id: 1 }, { id: 2 }],
          warnings: [],
          notes: ["a note"],
        },
      ],
    };
    const compact = compactSupplierSkuPreviewForDebug(body) as Record<string, unknown>;
    expect(compact.row_count).toBe(1);
    expect(compact.totals).toEqual({ match: 1 });
    expect(compact.candidates).toContain("900 candidates omitted");
    expect(compact.rows).toEqual([
      {
        row_id: 7,
        supplier_sku: "1-3T-CSN",
        supplier_name: "3 Tier Basic",
        price: "54.00",
        status: "blocked",
        matched: { id: 5, sku: "GS-5", status: "publish" },
        candidate_count: 2,
        warnings: [],
        notes: ["a note"],
      },
    ]);
  });

  it("leaves error bodies and non-preview shapes alone", () => {
    const error = { detail: { message: "failed", failures: [{ page: 1 }] } };
    expect(compactSupplierSkuPreviewForDebug(error)).toBe(error);
    expect(compactSupplierSkuPreviewForDebug(null)).toBeNull();
  });
});

describe("describeRequestBodyForDebug", () => {
  it("summarises multipart bodies instead of printing [object FormData]", () => {
    const form = new FormData();
    form.append("supplier_id", "2");
    form.append("file", new File(["%PDF-1.4"], "sheet.pdf", { type: "application/pdf" }));
    const text = describeRequestBodyForDebug(form) as string;
    expect(JSON.parse(text)).toEqual({
      multipart_form_data: { supplier_id: "2", file: "[file sheet.pdf, 8 bytes, application/pdf]" },
    });
  });

  it("passes strings through and returns undefined for no body", () => {
    expect(describeRequestBodyForDebug('{"a":1}')).toBe('{"a":1}');
    expect(describeRequestBodyForDebug(undefined)).toBeUndefined();
    expect(describeRequestBodyForDebug(null)).toBeUndefined();
  });
});
