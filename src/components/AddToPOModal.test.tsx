import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseOrder } from "../api/purchaseOrdersApi";
import AddToPOModal from "./AddToPOModal";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("../api/purchaseOrdersApi", () => ({
  purchaseOrdersApi: { list: mocks.list, get: mocks.get, update: mocks.update, create: mocks.create },
}));
vi.mock("../api/supplierSkuMappingApi", () => ({ supplierSkuMappingApi: { lookup: mocks.lookup } }));

const selected = [{ product_id: 501, sku: "GS-PLANTER-3-BA-SNOW", product_name: "3 Tier Basic Snow", qty: 4 }];

function purchaseOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 7,
    po_number: "PO-7",
    status: "draft",
    supplier_id: 2,
    supplier_currency: "USD",
    currency_conversion_rate: 1.5,
    lines: [],
    ...overrides,
  } as PurchaseOrder;
}

describe("AddToPOModal supplier defaults", () => {
  beforeEach(() => {
    mocks.list.mockResolvedValue([purchaseOrder()]);
    mocks.update.mockResolvedValue({});
    mocks.lookup.mockResolvedValue({
      supplier_id: 2,
      default_currency: "USD",
      items: [{ product_id: 501, supplier_id: 2, supplier_sku: "1-3T-CSN", supplier_price: "54.00" }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds the Supplier SKU and price to new lines of a PO for that supplier and closes", async () => {
    mocks.get.mockResolvedValue(purchaseOrder());
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddToPOModal open onClose={onClose} selectedItems={selected} />);
    await user.click(await screen.findByRole("button", { name: "Add to PO" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(mocks.lookup).toHaveBeenCalledWith(2, [501]);
    expect(mocks.update).toHaveBeenCalledWith(7, {
      lines: [
        expect.objectContaining({
          product_id: 501,
          sku: "GS-PLANTER-3-BA-SNOW",
          supplier_sku: "1-3T-CSN",
          supplier_unit_price: 54,
          supplier_total: 216,
          unit_price_aud: 81,
          total_aud: 324,
        }),
      ],
    });
  });

  it("keeps the dialog open with a warning when the price could not be copied", async () => {
    mocks.get.mockResolvedValue(purchaseOrder({ supplier_currency: "AUD" }));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddToPOModal open onClose={onClose} selectedItems={selected} />);
    await user.click(await screen.findByRole("button", { name: "Add to PO" }));

    expect(await screen.findByText(/was not copied because/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(7, {
      lines: [expect.objectContaining({ supplier_sku: "1-3T-CSN", supplier_unit_price: 0, supplier_total: 0 })],
    });
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("does not look up supplier values for a PO without a supplier", async () => {
    mocks.get.mockResolvedValue(purchaseOrder({ supplier_id: undefined }));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddToPOModal open onClose={onClose} selectedItems={selected} />);
    await user.click(await screen.findByRole("button", { name: "Add to PO" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("stops and shows the error when the lookup fails, without saving the PO", async () => {
    mocks.get.mockResolvedValue(purchaseOrder());
    mocks.lookup.mockRejectedValue(new Error("lookup exploded"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddToPOModal open onClose={onClose} selectedItems={selected} />);
    await user.click(await screen.findByRole("button", { name: "Add to PO" }));
    expect(await screen.findByText(/lookup exploded/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
