import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseOrder, purchaseOrdersApi } from "../api/purchaseOrdersApi";
import PurchaseOrderModal from "./PurchaseOrderModal";

vi.mock("../api/suppliersApi", () => ({
  suppliersApi: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./PurchaseOrderProductSearch", () => ({
  default: () => <div>Product search</div>,
}));

const purchaseOrder = {
  id: 1,
  po_number: "PO-1",
  status: "draft",
  created_date: "2026-10-04 00:00:00",
  created_by: "operator",
  shipping_type: "sea",
  lead_time_days: 0,
  eta_date: null,
  preorder_cutoff_date: null,
  supplier_currency: "AUD",
  currency_conversion_rate: 1,
  m3: 0,
  m3_rate: 0,
  pallet_weight: 0,
  number_of_pallets: 0,
  supplier_order_number: "",
  product_cost_adjustments_origin: 0,
  product_cost_origin: 0,
  shipping_cost_origin: 0,
  total_cost_origin: 0,
  shipping_cost_origin_aud: 0,
  shipping_cost_aud: 0,
  product_cost_aud: 0,
  product_cost_adjustments_aud: 0,
  total_cost_aud: 0,
  lines: [{
    product_id: 10,
    sku: "WSVI-2",
    product_name: "WSVI two pack",
    qty: 5,
    stock_qty: 48,
    stock_target_type: "wsvi_group",
    days_of_cover: 24.4,
    reorder_within_lead_time: true,
    avg_daily_usage: 2,
    forecast_source: "reviewed_orders_and_live_ledger",
    forecast_window_days: 180,
    effective_lead_time_days: 90,
  }],
} as PurchaseOrder;

describe("PurchaseOrderModal stock quantity", () => {
  it("shows canonical pooled stock as a read-only line value", async () => {
    const view = render(
      <PurchaseOrderModal
        open
        onClose={vi.fn()}
        onApplied={vi.fn()}
        po={purchaseOrder}
      />,
    );

    expect(await view.findByText("Stock Qty")).toBeInTheDocument();
    expect(view.getByTitle("Current pooled WSVI stock quantity"))
      .toHaveTextContent("48");
    expect(view.getByText("Days of Cover")).toBeInTheDocument();
    expect(view.getByTitle(/Average daily usage 2/)).toHaveTextContent("24.4");
    expect(view.getByText("Needs Reorder")).toBeInTheDocument();
    expect(view.getByTitle("Compared with 90-day effective lead time"))
      .toHaveTextContent("Yes");
  });
});

describe("PurchaseOrderModal apply", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves an existing purchase order and leaves the editor open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onApplied = vi.fn();
    const reloaded = {
      ...purchaseOrder,
      lines: [{ ...purchaseOrder.lines[0], id: 44 }],
    };
    vi.spyOn(purchaseOrdersApi, "update").mockResolvedValue(reloaded);
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(reloaded);

    const view = render(
      <PurchaseOrderModal open onClose={onClose} onApplied={onApplied} po={purchaseOrder} />,
    );
    await user.click(view.getByRole("button", { name: "Apply" }));

    expect(await view.findByText("Purchase order saved.")).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalledWith(reloaded);
    expect(onClose).not.toHaveBeenCalled();
    expect(purchaseOrdersApi.get).toHaveBeenCalledWith(1);
  });

  it("creates a purchase order once, then updates it on the next apply", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onApplied = vi.fn();
    const created = {
      ...purchaseOrder,
      id: 9,
      lines: [{ ...purchaseOrder.lines[0], id: 51 }],
    };
    vi.spyOn(purchaseOrdersApi, "create").mockResolvedValue(created);
    vi.spyOn(purchaseOrdersApi, "update").mockResolvedValue(created);
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(created);

    const view = render(
      <PurchaseOrderModal open onClose={onClose} onApplied={onApplied} po={null} />,
    );
    await user.click(view.getByRole("button", { name: "Apply" }));
    expect(await view.findByText("Purchase order saved.")).toBeInTheDocument();
    expect(purchaseOrdersApi.create).toHaveBeenCalledTimes(1);

    view.rerender(
      <PurchaseOrderModal open onClose={onClose} onApplied={onApplied} po={created} />,
    );
    await user.click(view.getByRole("button", { name: "Apply" }));
    expect(purchaseOrdersApi.update).toHaveBeenCalledWith(9, expect.objectContaining({
      lines: [expect.objectContaining({ id: 51 })],
    }));
    expect(purchaseOrdersApi.create).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the editor after save", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.spyOn(purchaseOrdersApi, "update").mockResolvedValue(purchaseOrder);
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(purchaseOrder);

    const view = render(
      <PurchaseOrderModal open onClose={onClose} onApplied={vi.fn()} po={purchaseOrder} />,
    );
    await user.click(view.getByRole("button", { name: "Save" }));

    expect(onClose).toHaveBeenCalledWith(true);
    expect(purchaseOrdersApi.get).not.toHaveBeenCalled();
  });
});
