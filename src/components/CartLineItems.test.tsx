import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartLine } from "../types/cart";
import CartLineItems from "./CartLineItems";

function line(overrides: Partial<CartLine> & Pick<CartLine, "product_id" | "product_name">): CartLine {
  return {
    variation_id: 0,
    sku: "SKU",
    quantity: 1,
    unit_total: 10,
    line_subtotal: 10,
    line_total: 10,
    metadata: {},
    ...overrides,
  };
}

describe("CartLineItems", () => {
  it("nests matched bundle children under the parent and keeps standalone lines flat", () => {
    const view = render(
      <CartLineItems
        currency="AUD"
        lines={[
          line({
            product_id: 21,
            sku: "CHILD-1",
            product_name: "Child Mix",
            metadata: { yith_wcpb_parent_id: 20 },
          }),
          line({
            product_id: 30,
            sku: "TEA-1",
            product_name: "Standalone Tea",
          }),
          line({
            product_id: 20,
            sku: "BUNDLE-1",
            product_name: "Garden Bundle",
            metadata: { yith_wcpb_bundle_id: 20 },
          }),
        ]}
      />,
    );

    const rows = Array.from(view.container.querySelectorAll("[data-cart-line-role]"));
    expect(rows.map((node) => node.getAttribute("data-cart-line-role"))).toEqual([
      "standalone",
      "parent",
      "child",
    ]);
    expect(view.getByText("1 x Standalone Tea")).toBeInTheDocument();
    expect(view.getByText("1 x Garden Bundle")).toBeInTheDocument();
    expect(view.getByText("1 x Child Mix")).toBeInTheDocument();
    expect(view.getByText("Bundle")).toBeInTheDocument();
    expect(rows[2].textContent).toContain("Child Mix");
  });

  it("renders two identical kits as parent groups with their children underneath", () => {
    const view = render(
      <CartLineItems
        currency="AUD"
        lines={[
          line({
            product_id: 122044,
            sku: "BSF-TRA-1010-DP-NH-PI-01",
            product_name: "Bootstrap Farmer 1010 Deep Trays",
            line_total: 0,
            unit_total: 0,
            metadata: { bundle_parent_key_hash: "parent-kit-a" },
          }),
          line({
            product_id: 120574,
            sku: "BSF-POT-5.0-BL-08",
            product_name: "Standalone Pot Blue",
            line_total: 43.64,
            unit_total: 43.64,
          }),
          line({
            product_id: 122111,
            sku: "BSF-BDL-1010-SSK",
            product_name: "Bootstrap Farmer 1010 Seed Starter Kit",
            line_total: 25.45,
            unit_total: 25.45,
            line_key_hash: "parent-kit-a",
          }),
          line({
            product_id: 121060,
            sku: "BSF-DOM-1010-HD-5.5-01",
            product_name: "1010 Humidity Dome",
            line_total: 0,
            unit_total: 0,
            metadata: { bundle_parent_key_hash: "parent-kit-a" },
          }),
          line({
            product_id: 122111,
            sku: "BSF-BDL-1010-SSK",
            product_name: "Bootstrap Farmer 1010 Seed Starter Kit second",
            line_total: 25.45,
            unit_total: 25.45,
            line_key_hash: "parent-kit-b",
          }),
          line({
            product_id: 114051,
            sku: "BSF-INS-06-BL-01",
            product_name: "6 Cell Plug Tray Inserts",
            quantity: 6,
            line_total: 0,
            unit_total: 0,
            metadata: { bundle_parent_key_hash: "parent-kit-b" },
          }),
        ]}
      />,
    );

    const rows = Array.from(view.container.querySelectorAll("[data-cart-line-role]"));
    expect(rows.map((node) => [
      node.getAttribute("data-cart-line-role"),
      node.textContent,
    ])).toEqual([
      ["standalone", expect.stringContaining("Standalone Pot Blue")],
      ["parent", expect.stringContaining("Bootstrap Farmer 1010 Seed Starter Kit")],
      ["child", expect.stringContaining("Bootstrap Farmer 1010 Deep Trays")],
      ["child", expect.stringContaining("1010 Humidity Dome")],
      ["parent", expect.stringContaining("Bootstrap Farmer 1010 Seed Starter Kit second")],
      ["child", expect.stringContaining("6 Cell Plug Tray Inserts")],
    ]);
    expect(view.getAllByText("Bundle")).toHaveLength(2);
  });

  it("indents an unmatched hashed child without moving it under another line", () => {
    const view = render(
      <CartLineItems
        currency="AUD"
        lines={[
          line({
            product_id: 61,
            product_name: "Hashed child",
            metadata: { bundle_parent_key_hash: "no-parent-in-payload" },
          }),
          line({
            product_id: 60,
            product_name: "Loose item",
          }),
        ]}
      />,
    );

    const rows = view.container.querySelectorAll("[data-cart-line-role]");
    expect(Array.from(rows).map((node) => node.getAttribute("data-cart-line-role"))).toEqual([
      "child",
      "standalone",
    ]);
    expect(view.queryByText("Bundle")).not.toBeInTheDocument();
  });

  it("shows the empty cart copy", () => {
    const view = render(<CartLineItems currency="AUD" lines={[]} />);
    expect(view.getByText("This cart has no line items.")).toBeInTheDocument();
  });
});
