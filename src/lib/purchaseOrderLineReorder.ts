/**
 * Purchase Order line selection reorder.
 *
 * Move selected lines to the top or bottom while keeping relative order among
 * selected lines and among unselected lines. Sort by Woo SKU uses natural A–Z
 * order (numeric-aware). Empty selection is a no-op.
 */

export type SkuLine = {
  sku?: string | null;
};

export type SortableLine = SkuLine & {
  sort_order?: number;
};

export function compareSkuNatural(left?: string | null, right?: string | null): number {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function uniqueValidIndexes(indexes: readonly number[], length: number): number[] {
  const seen = new Set<number>();
  const valid: number[] = [];
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0 || index >= length || seen.has(index)) {
      continue;
    }
    seen.add(index);
    valid.push(index);
  }
  valid.sort((left, right) => left - right);
  return valid;
}

export function moveSelectedLinesToTop<T>(
  lines: readonly T[],
  selectedIndexes: readonly number[],
): T[] {
  const selected = uniqueValidIndexes(selectedIndexes, lines.length);
  if (selected.length === 0) {
    return [...lines];
  }
  const selectedSet = new Set(selected);
  const moved = selected.map((index) => lines[index]);
  const rest = lines.filter((_, index) => !selectedSet.has(index));
  return [...moved, ...rest];
}

export function moveSelectedLinesToBottom<T>(
  lines: readonly T[],
  selectedIndexes: readonly number[],
): T[] {
  const selected = uniqueValidIndexes(selectedIndexes, lines.length);
  if (selected.length === 0) {
    return [...lines];
  }
  const selectedSet = new Set(selected);
  const moved = selected.map((index) => lines[index]);
  const rest = lines.filter((_, index) => !selectedSet.has(index));
  return [...rest, ...moved];
}

export function sortLinesBySku<T extends SkuLine>(lines: readonly T[]): T[] {
  return sortLinesBySkuWithIndexMap(lines).lines;
}

export function sortLinesBySkuWithIndexMap<T extends SkuLine>(
  lines: readonly T[],
): { lines: T[]; indexMap: Map<number, number> } {
  const ranked = lines.map((line, index) => ({ line, index }));
  ranked.sort((left, right) => (
    compareSkuNatural(left.line.sku, right.line.sku) || left.index - right.index
  ));
  const indexMap = new Map(ranked.map((entry, newIndex) => [entry.index, newIndex]));
  return {
    lines: ranked.map((entry) => entry.line),
    indexMap,
  };
}

export function applyLineSortOrder<T extends SortableLine>(lines: readonly T[]): T[] {
  return lines.map((line, index) => ({ ...line, sort_order: index + 1 }));
}

export function selectedIndexesAfterMoveToTop(selectedIndexes: readonly number[]): number[] {
  const count = uniqueValidIndexes(selectedIndexes, Number.MAX_SAFE_INTEGER).length;
  return Array.from({ length: count }, (_, index) => index);
}

export function selectedIndexesAfterMoveToBottom(
  selectedIndexes: readonly number[],
  lineCount: number,
): number[] {
  const selected = uniqueValidIndexes(selectedIndexes, lineCount);
  const start = lineCount - selected.length;
  return selected.map((_, index) => start + index);
}

export function remapSelectedIndexes(
  selectedIndexes: readonly number[],
  indexMap: ReadonlyMap<number, number>,
): number[] {
  const next: number[] = [];
  for (const index of selectedIndexes) {
    const mapped = indexMap.get(index);
    if (mapped !== undefined) {
      next.push(mapped);
    }
  }
  return next;
}

export function remapIndexesAfterRemove(
  selectedIndexes: readonly number[],
  removedIndex: number,
): number[] {
  return selectedIndexes
    .filter((index) => index !== removedIndex)
    .map((index) => (index > removedIndex ? index - 1 : index));
}

export function remapIndexesAfterSwap(
  selectedIndexes: readonly number[],
  left: number,
  right: number,
): number[] {
  return selectedIndexes.map((index) => {
    if (index === left) return right;
    if (index === right) return left;
    return index;
  });
}

export function remapIndexesAfterDrag(
  selectedIndexes: readonly number[],
  from: number,
  to: number,
): number[] {
  return selectedIndexes.map((index) => {
    if (index === from) return to;
    if (from < to && index > from && index <= to) return index - 1;
    if (from > to && index >= to && index < from) return index + 1;
    return index;
  });
}
