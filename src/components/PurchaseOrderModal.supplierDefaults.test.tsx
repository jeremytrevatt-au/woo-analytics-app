import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderModal from "./PurchaseOrderModal";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("../api/suppliersApi", () => ({ suppliersApi: { getAll: mocks.getAll } }));
vi.mock("../api/supplierSkuMappingApi", () => ({ supplierSkuMappingApi: { lookup: mocks.lookup } }));
vi.mock("./PurchaseOrderProductSearch", () => ({
  default: ({ onAdd }: { onAdd: (product: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onAdd({ id: 501, sku: "GS-PLANTER-3-BA-SNOW", name: "3 Tier Basic Snow", type: "variation", parent_id: 1 })}
    >
      Add test product
    </button>
  ),
}));

async function chooseOption(user: ReturnType<typeof userEvent.setup>, fieldName: string, optionName: string) {
  await user.click(screen.getByRole("combobox", { name: fieldName }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("PurchaseOrderModal supplier defaults", () => {
  beforeEach(() => {
    mocks.getAll.mockResolvedValue([
      { id: 1, name: "Other Supplier", default_currency: "AUD", contact_name: "", email: "", default_lead_time_days: 0 },
      { id: 2, name: "GreenStalk", default_currency: "USD", contact_name: "", email: "", default_lead_time_days: 0 },
    ]);
    mocks.lookup.mockResolvedValue({
      supplier_id: 2,
      default_currency: "USD",
      items: [{ product_id: 501, supplier_id: 2, supplier_sku: "1-3T-CSN", supplier_price: "54.00" }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults a draft PO's currency to the chosen supplier's default currency", async () => {
    const user = userEvent.setup();
    render(<PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    await chooseOption(user, "Supplier", "GreenStalk");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Supplier Currency" })).toHaveTextContent("USD"));
  });

  it("copies the Supplier SKU and price onto a product added for the PO's supplier", async () => {
    const user = userEvent.setup();
    render(<PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    await chooseOption(user, "Supplier", "GreenStalk");
    await user.click(screen.getByRole("button", { name: "Add test product" }));

    expect(await screen.findByDisplayValue("1-3T-CSN")).toBeInTheDocument();
    // qty 1 at rate 1: unit, AUD unit, total and AUD total all show 54 (the row renders in more than one layout).
    expect(screen.getAllByDisplayValue("54").length).toBeGreaterThanOrEqual(4);
    expect(mocks.lookup).toHaveBeenCalledWith(2, [501]);
    // The line SKU stays the Woo SKU.
    expect(screen.getAllByDisplayValue("GS-PLANTER-3-BA-SNOW").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("1-3T-CSN")).toHaveLength(1);
  });

  it("copies only the SKU and shows a warning when the PO currency is not the supplier's currency", async () => {
    const user = userEvent.setup();
    render(<PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    await chooseOption(user, "Supplier", "GreenStalk");
    await chooseOption(user, "Supplier Currency", "AUD");
    await user.click(screen.getByRole("button", { name: "Add test product" }));

    expect(await screen.findByDisplayValue("1-3T-CSN")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("54")).not.toBeInTheDocument();
    const warning = await screen.findByText(/was not copied because/);
    expect(warning).toHaveTextContent("USD");
    expect(warning).toHaveTextContent("AUD");
    expect(within(document.body).getAllByText(/Supplier prices are not|Supplier SKUs are copied/).length).toBeGreaterThan(0);
  });

  it("does not look anything up when the PO has no supplier", async () => {
    const user = userEvent.setup();
    render(<PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Add test product" }));
    expect(await screen.findByLabelText("Edit SKU for row 1")).toBeInTheDocument();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("shows a plain error when the lookup fails and leaves the line without supplier values", async () => {
    mocks.lookup.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />);
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalled());
    await chooseOption(user, "Supplier", "GreenStalk");
    await user.click(screen.getByRole("button", { name: "Add test product" }));
    expect(await screen.findByText(/Supplier SKU lookup failed for GS-PLANTER-3-BA-SNOW/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("1-3T-CSN")).not.toBeInTheDocument();
  });
});
