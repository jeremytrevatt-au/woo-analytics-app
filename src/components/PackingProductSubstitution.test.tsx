import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PackingProductSubstitution, { canSubstitutePackingLine } from "./PackingProductSubstitution";

const apiMocks = vi.hoisted(() => ({
  previewProductSubstitution: vi.fn(),
  substituteProduct: vi.fn(),
}));

vi.mock("../api/productSubstitutionApi", () => apiMocks);

vi.mock("./ProductSearchAutocomplete", () => ({
  default: ({ onChange, isOptionDisabled }: { onChange: (value: { id: number; sku: string; name: string; type: string } | null) => void; isOptionDisabled?: (option: { type: string }) => boolean }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange({ id: 113890, sku: "TP-T5-120-6500", name: "Tube", type: "simple" })}
      >
        Choose replacement
      </button>
      <button
        type="button"
        onClick={() => onChange({ id: 50, sku: "PARENT", name: "Parent", type: "variable" })}
      >
        Choose variable parent
      </button>
      <span>{isOptionDisabled?.({ type: "variable" }) ? "variable parent blocked" : "variable parent allowed"}</span>
    </div>
  ),
}));

const preview = {
  old_sku: "NY94128",
  new_sku: "TP-T5-120-6500",
  old_stock_before: 33,
  old_stock_after: 35,
  new_stock_before: 11,
  new_stock_after: 6,
  price_difference: "212.00",
  currency: "AUD",
  line_total: "238.181818",
  line_tax: "23.82",
  shipment_tracking: "none",
  is_preview: true,
};

function renderSubstitution(onApplied = vi.fn()) {
  render(
    <PackingProductSubstitution
      orderId={900001}
      orderItemId={16719}
      currentSku="NY94128"
      remainingQuantity={2}
      productName="Example product"
      onApplied={onApplied}
    />,
  );
  return onApplied;
}

function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "Replace SKU" }));
}

describe("PackingProductSubstitution", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows substitution only for a remaining unshipped line", () => {
    expect(canSubstitutePackingLine({ remaining_quantity: 2, fulfilled_quantity: 0 })).toBe(true);
    expect(canSubstitutePackingLine({ remaining_quantity: 1, fulfilled_quantity: 1 })).toBe(false);
    expect(canSubstitutePackingLine({ remaining_quantity: 0, fulfilled_quantity: 2 })).toBe(false);
    expect(canSubstitutePackingLine({ remaining_quantity: 2, fulfilled_quantity: 0, is_bundle_parent: true })).toBe(false);
  });

  it("keeps the row to an R button until the replacement form is opened", () => {
    renderSubstitution();

    const button = screen.getByRole("button", { name: "Replace SKU" });
    expect(button).toHaveTextContent("R");
    expect(screen.queryByLabelText("Replacement SKU")).toBeNull();
    expect(screen.queryByLabelText("New quantity")).toBeNull();

    openForm();

    expect(screen.getByText("Order #900001 · line 16719")).toBeTruthy();
    expect(screen.getByText(/2 x NY94128/)).toBeTruthy();
    expect(screen.getByLabelText("New quantity")).toBeTruthy();
  });

  it("closes the form without submitting a substitution", async () => {
    renderSubstitution();
    openForm();

    fireEvent.click(screen.getByRole("button", { name: "Choose replacement" }));
    fireEvent.change(screen.getByLabelText("New quantity"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("New quantity")).toBeNull();
    });
    expect(apiMocks.substituteProduct).not.toHaveBeenCalled();
  });

  it("previews stock and the inclusive price difference, then confirms without a refund control", async () => {
    apiMocks.previewProductSubstitution.mockResolvedValue(preview);
    apiMocks.substituteProduct.mockResolvedValue({ packing_status: "unpacked" });
    const onApplied = renderSubstitution();
    openForm();

    expect(screen.getByText("variable parent blocked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /refund/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Choose replacement" }));
    fireEvent.change(screen.getByLabelText("New quantity"), { target: { value: "5" } });

    await waitFor(() => {
      expect(apiMocks.previewProductSubstitution).toHaveBeenCalledWith({
        order_id: 900001,
        order_item_id: 16719,
        replacement_product_id: 113890,
        new_quantity: 5,
      });
    });
    expect(await screen.findByText(/NY94128 33 to 35/)).toBeTruthy();
    expect(screen.getByText(/Price difference 212.00 AUD including GST/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /refund/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Confirm substitution" }));

    await waitFor(() => {
      expect(apiMocks.substituteProduct).toHaveBeenCalledWith({
        order_id: 900001,
        order_item_id: 16719,
        replacement_product_id: 113890,
        new_quantity: 5,
      });
    });
    expect(onApplied).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByLabelText("New quantity")).toBeNull();
    });
  });

  it("blocks a variable parent before preview", async () => {
    renderSubstitution();
    openForm();

    fireEvent.click(screen.getByRole("button", { name: "Choose variable parent" }));
    fireEvent.change(screen.getByLabelText("New quantity"), { target: { value: "5" } });

    expect(await screen.findByText(/variable parent product/i)).toBeTruthy();
    expect(apiMocks.previewProductSubstitution).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm substitution" })).toBeDisabled();
  });
});
