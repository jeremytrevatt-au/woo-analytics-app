import { describe, expect, it } from "vitest";
import { CartLine } from "../types/cart";
import { nestCartLines, readCartLineBundleFields } from "./cartLineNesting";

function line(
  overrides: Partial<CartLine> & Pick<CartLine, "product_id" | "product_name">,
): CartLine {
  return {
    variation_id: 0,
    sku: "",
    quantity: 1,
    unit_total: 0,
    line_subtotal: 0,
    line_total: 0,
    metadata: {},
    ...overrides,
  };
}

describe("cartLineNesting", () => {
  it("uses packing bundled_by / bundle_cart_key to nest children under the parent", () => {
    const child = line({
      product_id: 21,
      product_name: "Child SKU",
      bundled_by: "bundle-1",
    } as CartLine);
    const parent = line({
      product_id: 20,
      product_name: "Garden Bundle",
      bundle_cart_key: "bundle-1",
    } as CartLine);
    const standalone = line({
      product_id: 30,
      product_name: "Loose Pot",
    });

    const nested = nestCartLines([child, standalone, parent]);

    expect(nested.map((item) => item.line.product_name)).toEqual([
      "Loose Pot",
      "Garden Bundle",
      "Child SKU",
    ]);
    expect(nested.map((item) => item.role)).toEqual([
      "standalone",
      "parent",
      "child",
    ]);
  });

  it("matches YITH cart meta parent/bundle ids already stored on cart lines", () => {
    const childFirst = line({
      product_id: 41,
      product_name: "Soil",
      metadata: {
        yith_wcpb_parent_id: 40,
        yith_wcpb_bundle_id: 40,
      },
    });
    const parent = line({
      product_id: 40,
      product_name: "Raised Bed Bundle",
      metadata: {
        yith_wcpb_bundle_id: 40,
      },
    });
    const childSecond = line({
      product_id: 42,
      product_name: "Hardware",
      metadata: {
        yith_wcpb_parent_id: 40,
      },
    });

    const nested = nestCartLines([childFirst, childSecond, parent]);

    expect(nested.map((item) => item.line.product_name)).toEqual([
      "Raised Bed Bundle",
      "Soil",
      "Hardware",
    ]);
    expect(nested[0]).toMatchObject({ role: "parent", isParentBundle: true });
    expect(nested[1]).toMatchObject({ role: "child", isChildItem: true });
    expect(nested[2]).toMatchObject({ role: "child", isChildItem: true });
  });

  it("matches a hashed bundled_by pointer when the parent line key is present", () => {
    const parent = line({
      product_id: 50,
      product_name: "Parent",
      line_key_hash: "abc123",
    } as CartLine);
    const child = line({
      product_id: 51,
      product_name: "Nested child",
      metadata: { bundle_parent_key_hash: "abc123" },
    });

    const nested = nestCartLines([child, parent]);

    expect(nested.map((item) => item.role)).toEqual(["parent", "child"]);
    expect(nested.map((item) => item.line.product_name)).toEqual([
      "Parent",
      "Nested child",
    ]);
  });

  it("leaves a hashed child flat when no parent id or matching line key exists", () => {
    const standalone = line({
      product_id: 60,
      product_name: "Tea",
    });
    const orphanChild = line({
      product_id: 61,
      product_name: "Orphan child",
      metadata: { bundle_parent_key_hash: "missing-parent" },
    });

    const nested = nestCartLines([orphanChild, standalone]);

    expect(nested.map((item) => item.line.product_name)).toEqual([
      "Orphan child",
      "Tea",
    ]);
    expect(nested[0]).toMatchObject({ role: "child", isChildItem: true });
    expect(nested[1]).toMatchObject({ role: "standalone", isChildItem: false });
    expect(readCartLineBundleFields(orphanChild).isChildItem).toBe(true);
  });

  it("keeps standalone lines flat and unstyled as bundles", () => {
    const nested = nestCartLines([
      line({ product_id: 1, product_name: "A" }),
      line({ product_id: 2, product_name: "B" }),
    ]);

    expect(nested.map((item) => item.role)).toEqual(["standalone", "standalone"]);
    expect(nested.every((item) => !item.isParentBundle && !item.isChildItem)).toBe(true);
  });
});
