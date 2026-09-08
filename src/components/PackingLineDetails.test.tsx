import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PackingLineDetails, {
  findPackingColourSwatch,
  parsePackingProduct,
} from "./PackingLineDetails";

const description =
  "Greenstalk Vertical Planter - greenstalk-tier: greentalk-tier-5, greenstalk-colour: greenstalk-stunning-stone, greenstalk-texture: greenstalk-basic, Pre-order qty: 1, Pre-order ETA: August 28, 2026";

describe("PackingLineDetails", () => {
  it("separates the product name from each labelled attribute", () => {
    expect(parsePackingProduct(description)).toEqual({
      productName: "Greenstalk Vertical Planter",
      attributes: [
        { label: "greenstalk-tier", value: "greentalk-tier-5" },
        { label: "greenstalk-colour", value: "greenstalk-stunning-stone" },
        { label: "greenstalk-texture", value: "greenstalk-basic" },
        { label: "Pre-order qty", value: "1" },
        { label: "Pre-order ETA", value: "August 28, 2026" },
      ],
    });
  });

  it("leaves product names without attributes intact", () => {
    expect(parsePackingProduct("Premium Potting Mix - 25L")).toEqual({
      productName: "Premium Potting Mix - 25L",
      attributes: [],
    });
  });

  it("maps recognised colour attributes to a swatch", () => {
    expect(
      findPackingColourSwatch({
        label: "greenstalk-colour",
        value: "greenstalk-stunning-stone",
      }),
    ).toBe("#aaa59a");
    expect(findPackingColourSwatch({ label: "Size", value: "stone" })).toBeNull();
  });

  it("renders the reformatted packing line and SKU", () => {
    render(
      <PackingLineDetails
        description={description}
        quantity={1}
        sku="GS-PLANTER-5-BA-SS"
      />,
    );

    expect(screen.getByText("Greenstalk Vertical Planter")).toBeInTheDocument();
    expect(screen.getByText("greenstalk-tier:")).toBeInTheDocument();
    expect(screen.getByText("Pre-order ETA:")).toBeInTheDocument();
    expect(screen.getByText("1x GS-PLANTER-5-BA-SS")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /stunning-stone colour swatch/i })).toBeInTheDocument();
  });
});
