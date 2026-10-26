import { describe, expect, it } from "vitest";
import type { SkuMappingCandidate, SkuMappingPreviewRow } from "../api/supplierSkuMappingApi";
import {
  applyWrittenValues,
  buildCommitPreview,
  buildCommitReport,
  buildCommitRows,
  commitCountsFromUnknown,
  countActions,
  countByStatus,
  deriveRowViews,
  evaluateCurrent,
  filterViews,
  formatCommitResultLine,
  replaceableConflicts,
  setReplaceForRows,
  summarizeCommitCounts,
  updateRowEdit,
} from "./supplierSkuMapping";

const SUPPLIER = 2;

function candidate(id: number, overrides: Partial<SkuMappingCandidate> = {}): SkuMappingCandidate {
  return {
    id,
    type: "variation",
    sku: `GS-${id}`,
    status: "publish",
    parent_id: 1,
    parent_name: "Parent",
    name: "Parent",
    attributes: [],
    label: `Product ${id}`,
    supplier_id: null,
    supplier_sku: "",
    supplier_price: "",
    ...overrides,
  };
}

function row(rowId: number, overrides: Partial<SkuMappingPreviewRow> = {}): SkuMappingPreviewRow {
  return {
    row_id: rowId,
    page: 1,
    supplier_name: `Sheet product ${rowId}`,
    supplier_sku: `SUP-${rowId}`,
    price: "10.00",
    price_flag: "",
    case_qty: null,
    family: "vertical_planter",
    tier: 3,
    style: "Basic",
    colour: "Snow",
    colour_as_sheet: "Snow",
    height: null,
    aliases_applied: [],
    flags: [],
    notes: [],
    warnings: [],
    matched: candidate(100 + rowId),
    candidates: [],
    is_suggestion: false,
    include_default: true,
    base_status: "match",
    status: "match",
    ...overrides,
  };
}

describe("evaluateCurrent", () => {
  it("fills empty targets, detects identical values and conflicts", () => {
    expect(evaluateCurrent(candidate(1), SUPPLIER, "A", 10)).toBe("fill");
    expect(evaluateCurrent(candidate(1, { supplier_id: SUPPLIER, supplier_sku: "A", supplier_price: "10.0000" }), SUPPLIER, "A", 10)).toBe("unchanged");
    expect(evaluateCurrent(candidate(1, { supplier_id: SUPPLIER, supplier_sku: "B", supplier_price: "10" }), SUPPLIER, "A", 10)).toBe("conflict");
    expect(evaluateCurrent(candidate(1, { supplier_id: 9 }), SUPPLIER, "A", 10)).toBe("conflict");
    expect(evaluateCurrent(candidate(1, { supplier_id: SUPPLIER, supplier_sku: "A", supplier_price: "11" }), SUPPLIER, "A", 10)).toBe("conflict");
  });
});

describe("deriveRowViews", () => {
  it("writes matched rows and leaves unmatched ones uncommittable", () => {
    const views = deriveRowViews(
      [row(1), row(2, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false })],
      {},
      SUPPLIER,
    );
    expect(views[0].action).toBe("write");
    expect(views[1].action).toBe("excluded");
    expect(buildCommitRows(views, SUPPLIER)).toEqual([
      { product_id: 101, supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00", replace: false },
    ]);
  });

  it("skips unchanged rows and does not send them", () => {
    const matched = candidate(101, { supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00" });
    const views = deriveRowViews([row(1, { matched, base_status: "unchanged", status: "unchanged" })], {}, SUPPLIER);
    expect(views[0].status).toBe("unchanged");
    expect(views[0].action).toBe("skip_unchanged");
    expect(buildCommitRows(views, SUPPLIER)).toEqual([]);
  });

  it("skips conflicts unless Replace is ticked", () => {
    const matched = candidate(101, { supplier_id: SUPPLIER, supplier_sku: "OLD", supplier_price: "9.00" });
    const conflict = row(1, { matched, base_status: "conflict", status: "conflict" });
    const without = deriveRowViews([conflict], {}, SUPPLIER);
    expect(without[0].action).toBe("skip_conflict");
    expect(buildCommitRows(without, SUPPLIER)).toEqual([]);

    const withReplace = deriveRowViews([conflict], updateRowEdit({}, 1, { replace: true }), SUPPLIER);
    expect(withReplace[0].action).toBe("replace");
    expect(buildCommitRows(withReplace, SUPPLIER)[0]).toMatchObject({ product_id: 101, replace: true });
  });

  it("recomputes status when the Supplier SKU is edited", () => {
    const matched = candidate(101, { supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00" });
    const unchangedRow = row(1, { matched, base_status: "unchanged", status: "unchanged" });
    const edited = deriveRowViews([unchangedRow], updateRowEdit({}, 1, { sku: "SUP-1-FIXED" }), SUPPLIER);
    expect(edited[0].status).toBe("conflict");
    expect(edited[0].skuEdited).toBe(true);
  });

  it("blocks duplicate Supplier SKUs inside the batch and clears when one is edited", () => {
    const rows = [row(1, { supplier_sku: "DUP" }), row(2, { supplier_sku: "dup" })];
    const blocked = deriveRowViews(rows, {}, SUPPLIER);
    expect(blocked.map((view) => view.status)).toEqual(["sheet_warning", "sheet_warning"]);
    expect(blocked.map((view) => view.action)).toEqual(["not_committable", "not_committable"]);
    expect(buildCommitRows(blocked, SUPPLIER)).toEqual([]);

    const fixed = deriveRowViews(rows, updateRowEdit({}, 2, { sku: "DUP-2" }), SUPPLIER);
    expect(fixed.map((view) => view.action)).toEqual(["write", "write"]);
  });

  it("rejects Supplier SKUs with spaces or nothing in them", () => {
    const views = deriveRowViews([row(1), row(2)], { 1: { sku: "has space" }, 2: { sku: "   " } }, SUPPLIER);
    expect(views.map((view) => view.status)).toEqual(["sheet_warning", "sheet_warning"]);
    expect(views.map((view) => view.action)).toEqual(["not_committable", "not_committable"]);
  });

  it("never commits Price TBD rows", () => {
    const views = deriveRowViews([row(1, { price: null, price_flag: "TBD", base_status: "price_tbd", status: "price_tbd" })], {}, SUPPLIER);
    expect(views[0].status).toBe("price_tbd");
    expect(views[0].action).toBe("not_committable");
    expect(buildCommitRows(views, SUPPLIER)).toEqual([]);
  });

  it("lets a manual selection resolve a No Woo product row and includes it", () => {
    const base = row(1, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false });
    const manual = candidate(555);
    const views = deriveRowViews([base], updateRowEdit({}, 1, { manualTarget: manual }), SUPPLIER);
    expect(views[0].isManual).toBe(true);
    expect(views[0].status).toBe("match");
    expect(views[0].action).toBe("write");
    expect(buildCommitRows(views, SUPPLIER)[0].product_id).toBe(555);
  });

  it("reports a manual selection of a private product as Woo disabled and a price-less one as Price TBD", () => {
    const base = row(1, { matched: null, base_status: "blocked", status: "blocked", include_default: false });
    const privateView = deriveRowViews([base], { 1: { manualTarget: candidate(9, { status: "private" }) } }, SUPPLIER);
    expect(privateView[0].status).toBe("woo_disabled");
    const tbd = deriveRowViews([{ ...base, price: null }], { 1: { manualTarget: candidate(9) } }, SUPPLIER);
    expect(tbd[0].status).toBe("price_tbd");
    expect(tbd[0].action).toBe("not_committable");
  });

  it("clearing a manual selection removes the target, even from an auto-matched row", () => {
    const views = deriveRowViews([row(1)], { 1: { manualTarget: null } }, SUPPLIER);
    expect(views[0].target).toBeNull();
    expect(views[0].action).toBe("not_committable");
  });

  it("blocks two included rows that point at the same Woo product", () => {
    const shared = candidate(777);
    const views = deriveRowViews([row(1, { matched: shared }), row(2, { matched: shared })], {}, SUPPLIER);
    expect(views.map((view) => view.sharedTarget)).toEqual([true, true]);
    expect(buildCommitRows(views, SUPPLIER)).toEqual([]);
    const excludedOne = deriveRowViews([row(1, { matched: shared }), row(2, { matched: shared })], { 2: { include: false } }, SUPPLIER);
    expect(excludedOne.map((view) => view.action)).toEqual(["write", "excluded"]);
  });

  it("keeps name-based suggestions excluded until the admin includes them", () => {
    const suggestion = row(1, { is_suggestion: true, include_default: false });
    expect(deriveRowViews([suggestion], {}, SUPPLIER)[0].action).toBe("excluded");
    expect(deriveRowViews([suggestion], { 1: { include: true } }, SUPPLIER)[0].action).toBe("write");
  });
});

describe("buildCommitReport", () => {
  it("lists server results for sent rows and reasons for rows that were not sent", () => {
    const conflictTarget = candidate(202, { supplier_id: SUPPLIER, supplier_sku: "OLD", supplier_price: "9.00" });
    const unchangedTarget = candidate(303, { supplier_id: SUPPLIER, supplier_sku: "SUP-3", supplier_price: "10.00" });
    const rows = [
      row(1),
      row(2, { matched: conflictTarget, base_status: "conflict", status: "conflict" }),
      row(3, { matched: unchangedTarget, base_status: "unchanged", status: "unchanged" }),
      row(4, { price: null, price_flag: "TBD", base_status: "price_tbd", status: "price_tbd" }),
      row(5, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false }),
    ];
    const views = deriveRowViews(rows, {}, SUPPLIER);
    const report = buildCommitReport(views, {
      success: true,
      counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
      results: [
        {
          index: 0,
          product_id: 101,
          status: "updated",
          before: { supplier_id: null, supplier_sku: "", supplier_price: "" },
          after: { supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00" },
        },
      ],
    });
    expect(report.map((entry) => [entry.rowId, entry.outcome])).toEqual([
      [1, "updated"],
      [2, "skipped_conflict"],
      [3, "skipped_unchanged"],
      [4, "skipped_not_committable"],
    ]);
    expect(report[0].after).toEqual({ supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00" });
    expect(report[3].message).toContain("Price TBD");
  });

  it("ties every entry to the named Woo product so before and after values read against a product", () => {
    const named = candidate(101, {
      name: "Greenstalk Vertical Planter",
      attributes: [{ name: "Tier", term_name: "3 Tier" }],
    });
    const views = deriveRowViews([row(1, { matched: named }), row(2, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false })], {}, SUPPLIER);
    const report = buildCommitReport(views, {
      success: true,
      counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
      results: [{ index: 0, product_id: 101, status: "updated" }],
    });
    expect(report).toHaveLength(1);
    expect(report[0].wooProduct).toEqual(named);
    expect(report[0].wooProduct?.name).toBe("Greenstalk Vertical Planter");
  });

  it("lists the rows about to be committed with their named Woo products", () => {
    const named = candidate(101, { name: "Greenstalk Vertical Planter", attributes: [{ name: "Tier", term_name: "3 Tier" }] });
    const conflictTarget = candidate(202, { supplier_id: SUPPLIER, supplier_sku: "OLD", supplier_price: "9.00" });
    const views = deriveRowViews(
      [row(1, { matched: named }), row(2, { matched: conflictTarget, base_status: "conflict", status: "conflict" })],
      {},
      SUPPLIER,
    );
    const preview = buildCommitPreview(views);
    expect(preview.map((entry) => [entry.rowId, entry.product.id, entry.replace])).toEqual([[1, 101, false]]);
    expect(preview[0].product.name).toBe("Greenstalk Vertical Planter");
    expect(preview[0].supplierSku).toBe("SUP-1");
    expect(preview[0].price).toBe("10.00");
    const replacingViews = deriveRowViews(
      [row(2, { matched: conflictTarget, base_status: "conflict", status: "conflict" })],
      { 2: { replace: true } },
      SUPPLIER,
    );
    const replacing = buildCommitPreview(replacingViews);
    expect(replacing[0].replace).toBe(true);
    // The confirmation lists exactly the products the commit payload will send.
    expect(replacing.map((entry) => entry.product.id)).toEqual(buildCommitRows(replacingViews, SUPPLIER).map((item) => item.product_id));
  });

  it("reports a sent row the server did not answer as an error", () => {
    const views = deriveRowViews([row(1)], {}, SUPPLIER);
    const report = buildCommitReport(views, { success: false, counts: { updated: 0, unchanged: 0, conflict_skipped: 0, error: 0 }, results: [] });
    expect(report[0].outcome).toBe("error");
  });
});

describe("summaries and filters", () => {
  const matched = candidate(202, { supplier_id: SUPPLIER, supplier_sku: "OLD", supplier_price: "9.00" });
  const rows = [
    row(1),
    row(2, { matched, base_status: "conflict", status: "conflict", family: "garden_lid" }),
    row(3, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false }),
  ];

  it("counts statuses and actions", () => {
    const views = deriveRowViews(rows, {}, SUPPLIER);
    expect(countByStatus(views)).toMatchObject({ match: 1, conflict: 1, no_woo_product: 1 });
    expect(countActions(views)).toMatchObject({ write: 1, skip_conflict: 1, excluded: 1 });
  });

  it("filters by status, family and search text", () => {
    const views = deriveRowViews(rows, {}, SUPPLIER);
    expect(filterViews(views, { statuses: ["conflict"], family: "", search: "" })).toHaveLength(1);
    expect(filterViews(views, { statuses: [], family: "garden_lid", search: "" })).toHaveLength(1);
    expect(filterViews(views, { statuses: [], family: "", search: "sup-3" })).toHaveLength(1);
  });

  it("lists replaceable conflicts with before and after values and applies Replace to them", () => {
    const views = deriveRowViews(rows, {}, SUPPLIER);
    const replacements = replaceableConflicts(views);
    expect(replacements).toEqual([
      {
        rowId: 2,
        supplierName: "Sheet product 2",
        wooSku: "GS-202",
        product: matched,
        before: { supplierSku: "OLD", supplierPrice: "9.00", supplierId: SUPPLIER },
        after: { supplierSku: "SUP-2", supplierPrice: "10.00" },
      },
    ]);
    const edits = setReplaceForRows({}, replacements.map((item) => item.rowId), true);
    const after = deriveRowViews(rows, edits, SUPPLIER);
    expect(buildCommitRows(after, SUPPLIER).map((item) => item.replace)).toEqual([false, true]);
  });
});

describe("commit result counts and written-row updates", () => {
  it("formats server counts as updated, skipped and failed", () => {
    const summary = summarizeCommitCounts({ updated: 96, unchanged: 2, conflict_skipped: 1, error: 3 });
    expect(summary).toEqual({ updated: 96, skipped: 3, failed: 3, total: 102 });
    expect(formatCommitResultLine(summary!)).toBe("Committed 102 rows: updated 96, skipped 3, failed 3");
    expect(commitCountsFromUnknown({ counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 2 } })).toEqual({
      updated: 1,
      unchanged: 0,
      conflict_skipped: 0,
      error: 2,
    });
  });

  it("marks successfully written rows unchanged so they drop out of the commit count", () => {
    const rows = [row(1), row(2)];
    const views = deriveRowViews(rows, {}, SUPPLIER);
    const committed = buildCommitRows(views, SUPPLIER);
    const applied = applyWrittenValues(
      rows,
      {},
      views,
      {
        success: true,
        counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
        results: [
          {
            index: 0,
            product_id: 101,
            status: "updated",
            after: { supplier_id: SUPPLIER, supplier_sku: "SUP-1", supplier_price: "10.00" },
          },
        ],
      },
      committed,
    );
    const next = deriveRowViews(applied.rows, applied.edits, SUPPLIER);
    expect(countActions(next)).toMatchObject({ write: 1, skip_unchanged: 1 });
    expect(next[0].status).toBe("unchanged");
    expect(next[1].action).toBe("write");
  });
});
