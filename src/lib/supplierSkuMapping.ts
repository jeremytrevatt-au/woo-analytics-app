/**
 * Pure state logic for the Supplier SKU Mapping page.
 * The server returns a preview; the admin then edits SKUs, picks products by hand, ticks include/replace.
 * Everything that follows from those edits (effective status, duplicate checks, the commit payload) is derived here
 * so it can be tested without rendering anything.
 */
import type {
  SkuMappingCandidate,
  SkuMappingCommitResponse,
  SkuMappingCommitRow,
  SkuMappingPreviewRow,
  SkuMappingStatus,
  SkuMappingSupplierValues,
} from "../api/supplierSkuMappingApi";

export type RowEdit = {
  sku?: string;
  include?: boolean;
  replace?: boolean;
  /** A product the admin picked by hand. null means "cleared"; undefined means "not touched". */
  manualTarget?: SkuMappingCandidate | null;
};

export type RowEdits = Record<number, RowEdit>;

export type RowAction =
  | "write"
  | "replace"
  | "skip_unchanged"
  | "skip_conflict"
  | "excluded"
  | "not_committable";

export type RowView = {
  row: SkuMappingPreviewRow;
  sku: string;
  skuEdited: boolean;
  target: SkuMappingCandidate | null;
  isManual: boolean;
  status: SkuMappingStatus;
  include: boolean;
  replace: boolean;
  duplicateSku: boolean;
  sharedTarget: boolean;
  skuProblem: string | null;
  /** Why this row cannot be committed (null when it can). */
  blockReason: string | null;
  action: RowAction;
};

export const STATUS_ORDER: SkuMappingStatus[] = [
  "match",
  "unchanged",
  "conflict",
  "blocked",
  "unmapped",
  "no_woo_product",
  "ambiguous",
  "price_tbd",
  "sheet_warning",
  "woo_disabled",
];

export const STATUS_LABELS: Record<SkuMappingStatus, string> = {
  match: "Match",
  unchanged: "Unchanged",
  conflict: "Conflict",
  blocked: "Blocked",
  unmapped: "Unmapped value",
  no_woo_product: "No Woo product",
  ambiguous: "Ambiguous",
  price_tbd: "Price TBD",
  sheet_warning: "Sheet data warning",
  woo_disabled: "Woo disabled",
};

const RECOMPUTED_BASE_STATUSES: SkuMappingStatus[] = ["match", "woo_disabled", "unchanged", "conflict"];

export function normalisePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export function pricesEqual(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < 0.00005;
}

export function validateSupplierSku(sku: string): string | null {
  if (!sku.trim()) return "The Supplier SKU is empty.";
  if (sku.trim().length > 100) return "The Supplier SKU is longer than 100 characters.";
  if (/\s/.test(sku.trim())) return "The Supplier SKU contains a space.";
  return null;
}

/** Mirrors the service matcher: compare proposed values with what the product already holds. */
export function evaluateCurrent(
  target: SkuMappingCandidate,
  supplierId: number,
  sku: string,
  price: number | null,
): "unchanged" | "conflict" | "fill" {
  const currentId = target.supplier_id;
  const currentSku = (target.supplier_sku || "").trim();
  const currentPrice = normalisePrice(target.supplier_price);
  const differs =
    (currentId !== null && currentId !== undefined && Number(currentId) !== supplierId)
    || (currentSku !== "" && currentSku !== sku)
    || (currentPrice !== null && price !== null && !pricesEqual(currentPrice, price));
  if (differs) return "conflict";
  if (currentId === supplierId && currentSku === sku && currentPrice !== null && pricesEqual(currentPrice, price)) {
    return "unchanged";
  }
  return "fill";
}

function skuKey(sku: string): string {
  return sku.trim().toLowerCase();
}

export function deriveRowViews(
  rows: SkuMappingPreviewRow[],
  edits: RowEdits,
  supplierId: number,
): RowView[] {
  const effectiveSku = (row: SkuMappingPreviewRow): string => {
    const edited = edits[row.row_id]?.sku;
    return (edited !== undefined ? edited : row.supplier_sku).trim();
  };

  const skuCounts = new Map<string, number>();
  for (const row of rows) {
    const key = skuKey(effectiveSku(row));
    if (!key) continue;
    skuCounts.set(key, (skuCounts.get(key) ?? 0) + 1);
  }

  const targetOf = (row: SkuMappingPreviewRow): { target: SkuMappingCandidate | null; isManual: boolean } => {
    const manual = edits[row.row_id]?.manualTarget;
    if (manual) return { target: manual, isManual: true };
    if (manual === null) return { target: null, isManual: false };
    return { target: row.matched, isManual: false };
  };

  const draft = rows.map((row) => {
    const edit = edits[row.row_id] ?? {};
    const sku = effectiveSku(row);
    const { target, isManual } = targetOf(row);
    const duplicateSku = (skuCounts.get(skuKey(sku)) ?? 0) > 1;
    const skuProblem = validateSupplierSku(sku);
    const price = normalisePrice(row.price);

    let status: SkuMappingStatus;
    if (skuProblem || duplicateSku) {
      status = "sheet_warning";
    } else if (isManual || (target && RECOMPUTED_BASE_STATUSES.includes(row.base_status))) {
      if (!target) {
        status = row.base_status;
      } else if (price === null) {
        status = "price_tbd";
      } else {
        const evaluation = evaluateCurrent(target, supplierId, sku, price);
        if (evaluation === "unchanged") status = "unchanged";
        else if (evaluation === "conflict") status = "conflict";
        else status = target.status === "publish" ? "match" : "woo_disabled";
      }
    } else {
      status = row.base_status;
    }

    const include = edit.include !== undefined ? edit.include : isManual ? true : row.include_default;
    return {
      row,
      sku,
      skuEdited: edit.sku !== undefined && edit.sku.trim() !== row.supplier_sku.trim(),
      target,
      isManual,
      status,
      include,
      replace: Boolean(edit.replace),
      duplicateSku,
      skuProblem,
    };
  });

  const includedTargetCounts = new Map<number, number>();
  for (const item of draft) {
    if (item.target && item.include) {
      includedTargetCounts.set(item.target.id, (includedTargetCounts.get(item.target.id) ?? 0) + 1);
    }
  }

  return draft.map((item) => {
    const sharedTarget = Boolean(item.target && item.include && (includedTargetCounts.get(item.target.id) ?? 0) > 1);
    const price = normalisePrice(item.row.price);
    let blockReason: string | null = null;
    if (!item.target) blockReason = "No Woo product is selected for this row.";
    else if (price === null) blockReason = "The sheet has no price for this row (Price TBD).";
    else if (item.skuProblem) blockReason = item.skuProblem;
    else if (item.duplicateSku) blockReason = "This Supplier SKU appears more than once in the sheet. Edit one of them.";
    else if (sharedTarget) blockReason = "More than one included row points at the same Woo product. Exclude or re-select one.";

    let action: RowAction;
    if (blockReason) {
      action = item.include ? "not_committable" : "excluded";
    } else if (item.status === "unchanged") {
      action = "skip_unchanged";
    } else if (!item.include) {
      action = "excluded";
    } else if (item.status === "conflict") {
      action = item.replace ? "replace" : "skip_conflict";
    } else {
      action = "write";
    }
    return { ...item, sharedTarget, blockReason, action };
  });
}

export function buildCommitRows(views: RowView[], supplierId: number): SkuMappingCommitRow[] {
  const commitRows: SkuMappingCommitRow[] = [];
  for (const view of views) {
    if ((view.action !== "write" && view.action !== "replace") || !view.target || view.row.price === null) continue;
    commitRows.push({
      product_id: view.target.id,
      supplier_id: supplierId,
      supplier_sku: view.sku,
      supplier_price: view.row.price,
      replace: view.action === "replace",
    });
  }
  return commitRows;
}

export type ActionCounts = Record<RowAction, number>;

export function countActions(views: RowView[]): ActionCounts {
  const counts: ActionCounts = {
    write: 0,
    replace: 0,
    skip_unchanged: 0,
    skip_conflict: 0,
    excluded: 0,
    not_committable: 0,
  };
  for (const view of views) counts[view.action] += 1;
  return counts;
}

export function countByStatus(views: RowView[]): Record<SkuMappingStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<SkuMappingStatus, number>;
  for (const view of views) counts[view.status] += 1;
  return counts;
}

export type ViewFilter = {
  statuses: SkuMappingStatus[];
  family: string;
  search: string;
};

export function filterViews(views: RowView[], filter: ViewFilter): RowView[] {
  const search = filter.search.trim().toLowerCase();
  return views.filter((view) => {
    if (filter.statuses.length > 0 && !filter.statuses.includes(view.status)) return false;
    if (filter.family && view.row.family !== filter.family) return false;
    if (search) {
      const haystack = [
        view.sku,
        view.row.supplier_name,
        view.target?.sku ?? "",
        view.target?.label ?? "",
        view.row.colour ?? "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export type ConflictReplacement = {
  rowId: number;
  supplierName: string;
  wooSku: string;
  before: { supplierSku: string; supplierPrice: string; supplierId: number | null };
  after: { supplierSku: string; supplierPrice: string };
};

/** Conflict rows that could be replaced right now: included, with a target and no other blocker. */
export function replaceableConflicts(views: RowView[]): ConflictReplacement[] {
  return views
    .filter((view) => view.status === "conflict" && view.include && !view.blockReason && view.target && view.row.price !== null)
    .map((view) => ({
      rowId: view.row.row_id,
      supplierName: view.row.supplier_name,
      wooSku: view.target?.sku ?? "",
      before: {
        supplierSku: view.target?.supplier_sku ?? "",
        supplierPrice: view.target?.supplier_price ?? "",
        supplierId: view.target?.supplier_id ?? null,
      },
      after: { supplierSku: view.sku, supplierPrice: view.row.price ?? "" },
    }));
}

export type CommitReportOutcome =
  | "updated"
  | "unchanged"
  | "conflict_skipped"
  | "error"
  | "skipped_unchanged"
  | "skipped_conflict"
  | "skipped_not_committable";

export type CommitReportEntry = {
  rowId: number;
  supplierName: string;
  supplierSku: string;
  wooId: number | null;
  wooSku: string;
  outcome: CommitReportOutcome;
  message: string;
  before: SkuMappingSupplierValues | null;
  after: SkuMappingSupplierValues | null;
};

/**
 * One line per row the admin could reasonably ask about after a commit: what the server did for the rows that were
 * sent, and why the other included/relevant rows were skipped. Plainly excluded rows are not listed.
 */
export function buildCommitReport(views: RowView[], response: SkuMappingCommitResponse): CommitReportEntry[] {
  const resultByProduct = new Map(response.results.map((result) => [result.product_id, result]));
  const entries: CommitReportEntry[] = [];
  for (const view of views) {
    const base = {
      rowId: view.row.row_id,
      supplierName: view.row.supplier_name,
      supplierSku: view.sku,
      wooId: view.target?.id ?? null,
      wooSku: view.target?.sku ?? "",
      before: null,
      after: null,
    };
    if (view.action === "write" || view.action === "replace") {
      const result = view.target ? resultByProduct.get(view.target.id) : undefined;
      entries.push({
        ...base,
        outcome: result ? result.status : "error",
        message: result ? result.message ?? "" : "The server returned no result for this row.",
        before: result?.before ?? null,
        after: result?.after ?? null,
      });
    } else if (view.action === "skip_unchanged") {
      entries.push({ ...base, outcome: "skipped_unchanged", message: "Values already identical; not sent." });
    } else if (view.action === "skip_conflict") {
      entries.push({ ...base, outcome: "skipped_conflict", message: "Conflict with existing values and Replace was not ticked; not sent." });
    } else if (view.action === "not_committable") {
      entries.push({ ...base, outcome: "skipped_not_committable", message: view.blockReason ?? "Cannot be committed." });
    }
  }
  return entries;
}

export function setReplaceForRows(edits: RowEdits, rowIds: number[], replace: boolean): RowEdits {
  const next: RowEdits = { ...edits };
  for (const rowId of rowIds) {
    next[rowId] = { ...(next[rowId] ?? {}), replace };
  }
  return next;
}

export function updateRowEdit(edits: RowEdits, rowId: number, patch: RowEdit): RowEdits {
  return { ...edits, [rowId]: { ...(edits[rowId] ?? {}), ...patch } };
}
