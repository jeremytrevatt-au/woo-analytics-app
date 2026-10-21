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

  it("nests two identical BSF-BDL kits when children appear before their parents", () => {
    const kitA = "parent-kit-a";
    const kitB = "parent-kit-b";
    const nested = nestCartLines([
      line({
        product_id: 122044,
        sku: "BSF-TRA-1010-DP-NH-PI-01",
        product_name: "Bootstrap Farmer 1010 Deep Trays",
        metadata: { bundle_parent_key_hash: kitA },
      }),
      line({
        product_id: 120574,
        sku: "BSF-POT-5.0-BL-08",
        product_name: "Bootstrap Farmer Seed Starter Pots Blue",
        line_total: 43.64,
        unit_total: 43.64,
      }),
      line({
        product_id: 120574,
        sku: "BSF-POT-5.0-PU-08",
        product_name: "Bootstrap Farmer Seed Starter Pots Purple",
        line_total: 43.64,
        unit_total: 43.64,
      }),
      line({
        product_id: 114051,
        sku: "BSF-INS-06-BL-01",
        product_name: "6 Cell Plug Tray Inserts",
        quantity: 6,
        metadata: { bundle_parent_key_hash: kitA },
      }),
      line({
        product_id: 114051,
        sku: "BSF-INS-06-BL-01",
        product_name: "6 Cell Plug Tray Inserts second kit",
        quantity: 6,
        metadata: { bundle_parent_key_hash: kitB },
      }),
      line({
        product_id: 122044,
        sku: "BSF-TRA-1010-DP-NH-BL-01",
        product_name: "1010 Deep Trays",
        metadata: { bundle_parent_key_hash: kitB },
      }),
      line({
        product_id: 122111,
        sku: "BSF-BDL-1010-SSK",
        product_name: "Bootstrap Farmer 1010 Seed Starter Kit",
        line_total: 25.45,
        unit_total: 25.45,
        line_key_hash: kitA,
      }),
      line({
        product_id: 121060,
        sku: "BSF-DOM-1010-HD-5.5-01",
        product_name: "1010 Humidity Dome",
        metadata: { bundle_parent_key_hash: kitA },
      }),
      line({
        product_id: 120574,
        sku: "BSF-POT-5.0-GR-08",
        product_name: "Bootstrap Farmer Seed Starter Pots Green",
        line_total: 43.64,
        unit_total: 43.64,
      }),
      line({
        product_id: 121060,
        sku: "BSF-DOM-1010-HD-5.5-01",
        product_name: "1010 Humidity Dome second kit",
        metadata: { bundle_parent_key_hash: kitB },
      }),
      line({
        product_id: 122111,
        sku: "BSF-BDL-1010-SSK",
        product_name: "Bootstrap Farmer 1010 Seed Starter Kit second",
        line_total: 25.45,
        unit_total: 25.45,
        line_key_hash: kitB,
      }),
    ]);

    expect(nested.map((item) => `${item.role}:${item.line.sku}:${item.line.product_name}`)).toEqual([
      "standalone:BSF-POT-5.0-BL-08:Bootstrap Farmer Seed Starter Pots Blue",
      "standalone:BSF-POT-5.0-PU-08:Bootstrap Farmer Seed Starter Pots Purple",
      "parent:BSF-BDL-1010-SSK:Bootstrap Farmer 1010 Seed Starter Kit",
      "child:BSF-TRA-1010-DP-NH-PI-01:Bootstrap Farmer 1010 Deep Trays",
      "child:BSF-INS-06-BL-01:6 Cell Plug Tray Inserts",
      "child:BSF-DOM-1010-HD-5.5-01:1010 Humidity Dome",
      "standalone:BSF-POT-5.0-GR-08:Bootstrap Farmer Seed Starter Pots Green",
      "parent:BSF-BDL-1010-SSK:Bootstrap Farmer 1010 Seed Starter Kit second",
      "child:BSF-INS-06-BL-01:6 Cell Plug Tray Inserts second kit",
      "child:BSF-TRA-1010-DP-NH-BL-01:1010 Deep Trays",
      "child:BSF-DOM-1010-HD-5.5-01:1010 Humidity Dome second kit",
    ]);
    expect(nested.filter((item) => item.role === "parent").every((item) => item.isParentBundle)).toBe(true);
  });

  it("does not attach both identical kit children to the first product_id match", () => {
    const nested = nestCartLines([
      line({
        product_id: 41,
        product_name: "Tray A",
        metadata: { yith_wcpb_parent_id: 40 },
      }),
      line({
        product_id: 42,
        product_name: "Tray B",
        metadata: { yith_wcpb_parent_id: 40 },
      }),
      line({
        product_id: 40,
        product_name: "Kit one",
        sku: "BSF-BDL-1010-SSK",
      }),
      line({
        product_id: 40,
        product_name: "Kit two",
        sku: "BSF-BDL-1010-SSK",
      }),
    ]);

    expect(nested.map((item) => `${item.role}:${item.line.product_name}`)).toEqual([
      "child:Tray A",
      "child:Tray B",
      "standalone:Kit one",
      "standalone:Kit two",
    ]);
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
