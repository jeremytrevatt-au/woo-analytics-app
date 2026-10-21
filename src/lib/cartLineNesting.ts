import { CartLine } from "../types/cart";

export type CartLineNestRole = "parent" | "child" | "standalone";

export type NestedCartLine = {
  line: CartLine;
  role: CartLineNestRole;
  isParentBundle: boolean;
  isChildItem: boolean;
};

type BundleFields = {
  childKeys: string[];
  parentKeys: string[];
  isChildItem: boolean;
  isDeclaredParent: boolean;
};

type CartLineBundleSource = CartLine & {
  bundled_by?: unknown;
  bundle_cart_key?: unknown;
  is_bundle_parent?: unknown;
  line_key_hash?: unknown;
  composite_parent?: unknown;
  yith_wcpb_parent_id?: unknown;
  yith_wcpb_bundle_id?: unknown;
  bundle_id?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scalarText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = scalarText(value);
    if (text) return text;
  }
  return "";
}

function positiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : null;
  }
  return null;
}

function pushKey(keys: string[], prefix: string, value: unknown): void {
  const text = scalarText(value);
  if (text) keys.push(`${prefix}:${text}`);
}

/**
 * Map packing bundle fields and the cart-line meta already captured by
 * NYA (`bundled_by` hash, YITH bundle/parent ids, composite parent).
 */
export function readCartLineBundleFields(line: CartLine): BundleFields {
  const source = line as CartLineBundleSource;
  const metadata = asRecord(line.metadata);

  const bundledBy = firstText(
    source.bundled_by,
    metadata.bundled_by,
    metadata.bundle_parent_key_hash,
    metadata.yith_bundle_parent,
    metadata.yith_wcpb_bundle_parent,
    source.composite_parent,
    metadata.composite_parent,
  );
  const packingBundleCartKey = firstText(
    source.bundle_cart_key,
    metadata.bundle_cart_key,
  );
  const lineKeyHash = firstText(source.line_key_hash, metadata.line_key_hash);
  const parentProductId = positiveInt(
    metadata.yith_wcpb_parent_id ?? source.yith_wcpb_parent_id,
  );
  const bundleId = positiveInt(
    metadata.yith_wcpb_bundle_id
    ?? metadata.bundle_id
    ?? source.yith_wcpb_bundle_id
    ?? source.bundle_id,
  );
  const isDeclaredParent = Boolean(source.is_bundle_parent)
    || Boolean(metadata.is_bundle_parent)
    || Boolean(packingBundleCartKey && !bundledBy);
  const isChildItem = Boolean(bundledBy) || parentProductId != null;

  const childKeys: string[] = [];
  if (isChildItem) {
    pushKey(childKeys, "cart", bundledBy);
    if (parentProductId != null) pushKey(childKeys, "product", parentProductId);
    if (bundleId != null) pushKey(childKeys, "bundle", bundleId);
  }

  const parentKeys: string[] = [];
  pushKey(parentKeys, "cart", packingBundleCartKey);
  pushKey(parentKeys, "cart", lineKeyHash);
  pushKey(parentKeys, "product", line.product_id);
  if (!isChildItem) {
    pushKey(parentKeys, "bundle", line.product_id);
    if (bundleId != null) pushKey(parentKeys, "bundle", bundleId);
  }

  return { childKeys, parentKeys, isChildItem, isDeclaredParent };
}

function keysIntersect(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const lookup = new Set(left);
  return right.some((key) => lookup.has(key));
}

function matchingParentIndexes(
  childKeys: string[],
  parentKeysByIndex: string[][],
  canBeParent: boolean[],
): number[] {
  const matches: number[] = [];
  parentKeysByIndex.forEach((parentKeys, index) => {
    if (canBeParent[index] && keysIntersect(childKeys, parentKeys)) {
      matches.push(index);
    }
  });
  return matches;
}

function nearestParent(childIndex: number, matches: number[]): number {
  const previous = [...matches].reverse().find((index) => index < childIndex);
  if (previous != null) return previous;
  return matches.find((index) => index > childIndex) ?? -1;
}

/**
 * Packing matches a child to one parent instance via bundled_by / bundle_cart_key.
 * Prefer that cart-item-key HMAC. Shared product/bundle ids are used only when
 * exactly one parent candidate matches; two identical kit SKUs must not share children.
 */
function findParentIndex(
  childIndex: number,
  childKeys: string[],
  parentKeysByIndex: string[][],
  canBeParent: boolean[],
): number {
  const instanceKeys = childKeys.filter((key) => key.startsWith("cart:"));
  const instanceMatches = matchingParentIndexes(instanceKeys, parentKeysByIndex, canBeParent);
  if (instanceMatches.length === 1) return instanceMatches[0];
  if (instanceMatches.length > 1) return nearestParent(childIndex, instanceMatches);

  const sharedKeys = childKeys.filter((key) => !key.startsWith("cart:"));
  const sharedMatches = matchingParentIndexes(sharedKeys, parentKeysByIndex, canBeParent);
  if (sharedMatches.length === 1) return sharedMatches[0];
  return -1;
}

export function nestCartLines(lines: CartLine[]): NestedCartLine[] {
  const fields = lines.map((line) => readCartLineBundleFields(line));
  const parentKeysByIndex = fields.map((item) => item.parentKeys);
  const candidateParent = fields.map((item) => !item.isChildItem);
  const childToParent = new Map<number, number>();
  const referencedParent = new Set<number>();

  lines.forEach((_, childIndex) => {
    if (!fields[childIndex].isChildItem) return;
    const parentIndex = findParentIndex(
      childIndex,
      fields[childIndex].childKeys,
      parentKeysByIndex,
      candidateParent,
    );
    if (parentIndex < 0) return;
    childToParent.set(childIndex, parentIndex);
    referencedParent.add(parentIndex);
  });

  const assignedChildren = new Set(childToParent.keys());
  const childrenByParent = new Map<number, number[]>();
  childToParent.forEach((parentIndex, childIndex) => {
    const existing = childrenByParent.get(parentIndex) ?? [];
    existing.push(childIndex);
    childrenByParent.set(parentIndex, existing);
  });

  const nested: NestedCartLine[] = [];
  lines.forEach((line, index) => {
    if (assignedChildren.has(index)) return;

    const isParentBundle = fields[index].isDeclaredParent || referencedParent.has(index);
    const isChildItem = fields[index].isChildItem && !isParentBundle;
    nested.push({
      line,
      role: isParentBundle ? "parent" : isChildItem ? "child" : "standalone",
      isParentBundle,
      isChildItem,
    });

    (childrenByParent.get(index) ?? []).forEach((childIndex) => {
      nested.push({
        line: lines[childIndex],
        role: "child",
        isParentBundle: false,
        isChildItem: true,
      });
    });
  });

  return nested;
}
