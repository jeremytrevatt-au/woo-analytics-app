import { describe, expect, it } from "vitest";
import { formatAttributes, formatIdentity, formatProductOneLine } from "./wooProductDisplay";

const variation = {
  id: 123,
  sku: "GS-PLANTER-3-BA-STONE",
  status: "publish",
  name: "Greenstalk Vertical Planter",
  attributes: [
    { name: "Tier", term_name: "3 Tier" },
    { name: "Style", term_name: "Basic" },
    { name: "Colour", term_name: "Stunning Stone" },
  ],
};

describe("wooProductDisplay", () => {
  it("joins variation attributes as Name: term name", () => {
    expect(formatAttributes(variation)).toBe("Tier: 3 Tier, Style: Basic, Colour: Stunning Stone");
  });

  it("shows no attribute text for a simple product", () => {
    expect(formatAttributes({ attributes: [] })).toBe("");
  });

  it("shows a blank attribute term as Any", () => {
    expect(formatAttributes({ attributes: [{ name: "Colour", term_name: "" }] })).toBe("Colour: Any");
  });

  it("formats id, SKU and status, naming private products as private and published ones as published", () => {
    expect(formatIdentity(variation)).toBe("#123 / GS-PLANTER-3-BA-STONE / published");
    expect(formatIdentity({ id: 9, sku: "", status: "private" })).toBe("#9 / (no SKU) / private");
  });

  it("builds a searchable one-line text with name, attributes and identity", () => {
    const text = formatProductOneLine(variation);
    expect(text).toContain("Greenstalk Vertical Planter");
    expect(text).toContain("Colour: Stunning Stone");
    expect(text).toContain("#123");
    expect(text).toContain("GS-PLANTER-3-BA-STONE");
    expect(formatProductOneLine({ id: 5, sku: "GS-SPINNER", status: "publish", name: "Ultimate Spinner", attributes: [] })).toBe(
      "Ultimate Spinner - #5 / GS-SPINNER / published",
    );
  });
});
