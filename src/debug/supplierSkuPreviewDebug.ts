/**
 * Shrinks the Supplier SKU Mapping preview response for the debug panel and the diagnostics mirror.
 * The full response carries every Woo candidate on every row (~500 KB), which makes the panel unusable.
 * The compact form keeps what is needed to refer to a row precisely: row id, SKU, name, status, match and messages.
 */

export const SUPPLIER_SKU_PREVIEW_PATH = "/api/v1/supplier-sku-mapping/preview";

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function compactSupplierSkuPreviewForDebug(body: unknown): unknown {
  if (!isRecord(body) || !Array.isArray(body.rows)) {
    return body;
  }
  const rows = body.rows.map((row) => {
    if (!isRecord(row)) return row;
    const matched = isRecord(row.matched) ? { id: row.matched.id, sku: row.matched.sku, status: row.matched.status } : null;
    return {
      row_id: row.row_id,
      supplier_sku: row.supplier_sku,
      supplier_name: row.supplier_name,
      price: row.price,
      status: row.status,
      matched,
      candidate_count: Array.isArray(row.candidates) ? row.candidates.length : 0,
      warnings: row.warnings,
      notes: row.notes,
    };
  });
  return {
    ...body,
    rows,
    candidates: `[${Array.isArray(body.candidates) ? body.candidates.length : 0} candidates omitted from debug view]`,
    woo_without_supplier_row: `[${Array.isArray(body.woo_without_supplier_row) ? body.woo_without_supplier_row.length : 0} items omitted from debug view]`,
    debug_note: "Compact view: full row detail (per-row candidate lists) is omitted here. Row ids match the table on the page.",
  };
}

/** Describes a request body for the debug panel. FormData is summarised instead of printed as [object FormData]. */
export function describeRequestBodyForDebug(body: BodyInit | null | undefined): string | undefined {
  if (!body) return undefined;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const fields: Record<string, string> = {};
    body.forEach((value, key) => {
      fields[key] = typeof value === "string" ? value : `[file ${value.name}, ${value.size} bytes, ${value.type || "unknown type"}]`;
    });
    return JSON.stringify({ multipart_form_data: fields });
  }
  return String(body);
}
