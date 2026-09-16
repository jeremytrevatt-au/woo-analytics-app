import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchResult } from "../api/productsApi";
import { ProductIndexProvider } from "./ProductIndexProvider";
import StockProductSearch from "./StockProductSearch";

const products: ProductSearchResult[] = [
  { id: 10, name: "Blue Planter", sku: "PLAN-BLUE", type: "simple", edit_product_id: 10 },
  { id: 11, name: "Green Planter", sku: "PLAN-GREEN", type: "simple", edit_product_id: 11 },
];

const productsApiMock = vi.hoisted(() => ({
  getIndex: vi.fn(),
}));

vi.mock("../api/productsApi", async () => {
  const actual = await vi.importActual("../api/productsApi");
  return {
    ...actual,
    productsApi: productsApiMock,
  };
});

describe("StockProductSearch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("filters locally while typing then confirms a global product selection", async () => {
    productsApiMock.getIndex.mockResolvedValue(products);
    const onLocalQueryChange = vi.fn();
    const onConfirm = vi.fn();
    const view = render(
      <ProductIndexProvider>
        <StockProductSearch
          onLocalQueryChange={onLocalQueryChange}
          onConfirm={onConfirm}
          onClear={vi.fn()}
        />
      </ProductIndexProvider>,
    );

    const input = await view.findByLabelText("Search SKU or Product Name");
    fireEvent.change(input, { target: { value: "PLAN-B" } });
    await view.findByText("[PLAN-BLUE] Blue Planter");
    expect(onLocalQueryChange).toHaveBeenCalledWith("PLAN-B");

    fireEvent.keyDown(input, { key: "Tab" });
    await waitFor(() => expect(view.getByText(/Suggestion accepted/)).toBeInTheDocument());
    expect(onLocalQueryChange).toHaveBeenCalledWith("PLAN-BLUE");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledWith("PLAN-BLUE");
  });

  it("submits a partial SKU without requiring a suggestion selection", async () => {
    productsApiMock.getIndex.mockResolvedValue(products);
    const onConfirm = vi.fn();
    const view = render(
      <ProductIndexProvider>
        <StockProductSearch
          onLocalQueryChange={vi.fn()}
          onConfirm={onConfirm}
          onClear={vi.fn()}
        />
      </ProductIndexProvider>,
    );

    const input = await view.findByLabelText("Search SKU or Product Name");
    fireEvent.change(input, { target: { value: "PLAN-" } });
    await view.findByText("[PLAN-BLUE] Blue Planter");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledWith("PLAN-");
  });
});
