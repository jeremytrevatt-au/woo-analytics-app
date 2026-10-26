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

export type CommitPreviewEntry = {
  rowId: number;
  supplierName: string;
  supplierSku: string;
  price: string;
  replace: boolean;
  product: SkuMappingCandidate;
};

/** The rows the commit confirmation is about to send, each tied to a named Woo product. Mirrors buildCommitRows. */
export function buildCommitPreview(views: RowView[]): CommitPreviewEntry[] {
  const entries: CommitPreviewEntry[] = [];
  for (const view of views) {
    if ((view.action !== "write" && view.action !== "replace") || !view.target || view.row.price === null) continue;
    entries.push({
      rowId: view.row.row_id,
      supplierName: view.row.supplier_name,
      supplierSku: view.sku,
      price: view.row.price,
      replace: view.action === "replace",
      product: view.target,
    });
  }
  return entries;
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
  product: SkuMappingCandidate;
  before: { supplierSku: string; supplierPrice: string; supplierId: number | null };
  after: { supplierSku: string; supplierPrice: string };
};

/** Conflict rows that could be replaced right now: included, with a target and no other blocker. */
export function replaceableConflicts(views: RowView[]): ConflictReplacement[] {
  return views
    .filter((view): view is RowView & { target: SkuMappingCandidate } =>
      view.status === "conflict" && view.include && !view.blockReason && view.target !== null && view.row.price !== null)
    .map((view) => ({
      rowId: view.row.row_id,
      supplierName: view.row.supplier_name,
      wooSku: view.target.sku,
      product: view.target,
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
  /** The Woo product (name, attributes, id, SKU, status) the before/after values belong to. */
  wooProduct: SkuMappingCandidate | null;
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
      wooProduct: view.target,
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

export type CommitCountSummary = {
  updated: number;
  skipped: number;
  failed: number;
  total: number;
};

export type CommitCounts = SkuMappingCommitResponse["counts"];

function asCount(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Server counts as updated / skipped (unchanged + conflict_skipped) / failed. */
export function summarizeCommitCounts(counts: CommitCounts | null | undefined): CommitCountSummary | null {
  if (!counts) return null;
  const updated = asCount(counts.updated);
  const skipped = asCount(counts.unchanged) + asCount(counts.conflict_skipped);
  const failed = asCount(counts.error);
  return { updated, skipped, failed, total: updated + skipped + failed };
}

export function formatCommitResultLine(counts: CommitCountSummary): string {
  return `Committed ${counts.total} rows: updated ${counts.updated}, skipped ${counts.skipped}, failed ${counts.failed}`;
}

export function commitCountsFromUnknown(value: unknown): CommitCounts | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const nested = record.counts && typeof record.counts === "object" && !Array.isArray(record.counts)
    ? record.counts
    : record.detail && typeof record.detail === "object" && !Array.isArray(record.detail)
      ? (record.detail as { counts?: unknown }).counts
      : null;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
  const raw = nested as Record<string, unknown>;
  if (!("updated" in raw) && !("error" in raw) && !("unchanged" in raw) && !("conflict_skipped" in raw)) {
    return null;
  }
  return {
    updated: asCount(raw.updated),
    unchanged: asCount(raw.unchanged),
    conflict_skipped: asCount(raw.conflict_skipped),
    error: asCount(raw.error),
  };
}

function writtenValuesForProduct(
  productId: number,
  response: SkuMappingCommitResponse,
  committedRows: SkuMappingCommitRow[],
): SkuMappingSupplierValues | null {
  const result = response.results.find((item) => item.product_id === productId);
  if (!result || (result.status !== "updated" && result.status !== "unchanged")) return null;
  if (result.after) return result.after;
  const sent = committedRows.find((row) => row.product_id === productId);
  if (!sent) return null;
  return { supplier_id: sent.supplier_id, supplier_sku: sent.supplier_sku, supplier_price: sent.supplier_price };
}

/**
 * After a successful write, put the stored supplier values onto the preview rows so they become
 * Unchanged and drop out of the Commit N rows count without a full page reload.
 */
export function applyWrittenValues(
  rows: SkuMappingPreviewRow[],
  edits: RowEdits,
  views: RowView[],
  response: SkuMappingCommitResponse,
  committedRows: SkuMappingCommitRow[],
): { rows: SkuMappingPreviewRow[]; edits: RowEdits } {
  const written = new Map<number, SkuMappingSupplierValues>();
  for (const view of views) {
    if ((view.action !== "write" && view.action !== "replace") || !view.target) continue;
    const values = writtenValuesForProduct(view.target.id, response, committedRows);
    if (values) written.set(view.row.row_id, values);
  }

  const nextRows = rows.map((row) => {
    const view = views.find((entry) => entry.row.row_id === row.row_id);
    const values = written.get(row.row_id);
    if (!view || !values || view.isManual || !row.matched) return row;
    return {
      ...row,
      matched: {
        ...row.matched,
        supplier_id: values.supplier_id,
        supplier_sku: values.supplier_sku,
        supplier_price: values.supplier_price,
      },
      base_status: "unchanged" as const,
    };
  });

  const nextEdits: RowEdits = { ...edits };
  for (const view of views) {
    const values = written.get(view.row.row_id);
    if (!values) continue;
    const existing = nextEdits[view.row.row_id] ?? {};
    nextEdits[view.row.row_id] = {
      ...existing,
      replace: false,
      manualTarget:
        view.isManual && existing.manualTarget
          ? {
              ...existing.manualTarget,
              supplier_id: values.supplier_id,
              supplier_sku: values.supplier_sku,
              supplier_price: values.supplier_price,
            }
          : existing.manualTarget,
    };
  }
  return { rows: nextRows, edits: nextEdits };
}
