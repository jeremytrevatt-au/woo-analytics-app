import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchResult } from "../api/productsApi";
import type { PurchaseOrderLine } from "../api/purchaseOrdersApi";
import PurchaseOrderProductSearch from "./PurchaseOrderProductSearch";

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

describe("PurchaseOrderProductSearch", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("accepts the highlighted suggestion with Tab and confirms it with Enter", async () => {
    productsApiMock.getIndex.mockResolvedValue(products);
    const onAdd = vi.fn();
    const onFilterChange = vi.fn();
    const view = render(
      <PurchaseOrderProductSearch
        lines={[]}
        onAdd={onAdd}
        onExisting={vi.fn()}
        onFilterChange={onFilterChange}
      />,
    );

    const input = await view.findByLabelText("Search SKU or Product Name");
    fireEvent.change(input, { target: { value: "PLAN-B" } });
    await view.findByText("[PLAN-BLUE] Blue Planter");
    fireEvent.keyDown(input, { key: "Tab" });

    await waitFor(() => expect(view.getByText(/Suggestion accepted/)).toBeInTheDocument());
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onAdd).toHaveBeenCalledWith(products[0]);
    expect(onFilterChange).toHaveBeenCalledWith("PLAN-BLUE");
  });

  it("focuses an existing line instead of adding a duplicate", async () => {
    productsApiMock.getIndex.mockResolvedValue(products);
    const existingLine: PurchaseOrderLine = {
      product_id: 10,
      sku: "PLAN-BLUE",
      product_name: "Blue Planter",
      qty: 1,
    };
    const onAdd = vi.fn();
    const onExisting = vi.fn();
    const view = render(
      <PurchaseOrderProductSearch
        lines={[existingLine]}
        onAdd={onAdd}
        onExisting={onExisting}
        onFilterChange={vi.fn()}
      />,
    );

    const input = await view.findByLabelText("Search SKU or Product Name");
    fireEvent.change(input, { target: { value: "PLAN-B" } });
    const option = await view.findByText("[PLAN-BLUE] Blue Planter");
    fireEvent.click(option);
    fireEvent.click(view.getByRole("button", { name: "Add Product" }));

    expect(onExisting).toHaveBeenCalledWith(0, products[0]);
    expect(onAdd).not.toHaveBeenCalled();
    expect(view.getByText(/Already on this PO/)).toBeInTheDocument();
  });
});
