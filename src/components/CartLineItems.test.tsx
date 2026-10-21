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
