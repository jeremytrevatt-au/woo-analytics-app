import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { purchaseOrdersApi, type PurchaseOrder } from "../api/purchaseOrdersApi";
import { preordersApi } from "../api/preordersApi";
import PurchaseOrdersPage from "./PurchaseOrdersPage";

vi.mock("../api/purchaseOrdersApi", async () => {
  const actual = await vi.importActual<typeof import("../api/purchaseOrdersApi")>("../api/purchaseOrdersApi");
  return {
    ...actual,
    purchaseOrdersApi: {
      ...actual.purchaseOrdersApi,
      list: vi.fn(),
    },
  };
});

vi.mock("../api/preordersApi", () => ({
  preordersApi: {
    getPurchaseOrderSummary: vi.fn(),
    bulkAllocatePurchaseOrder: vi.fn(),
    allocatePurchaseOrderLine: vi.fn(),
    updateAllocation: vi.fn(),
    updateReserveAllocation: vi.fn(),
    bulkUpdateReserveAllocations: vi.fn(),
    deleteAllocation: vi.fn(),
  },
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
    id: 44,
    product_id: 10,
    sku: "PLAN-BLUE",
    product_name: "Planter Blue",
    qty: 5,
    stock_qty: 48,
    preordered_qty: 3,
    backordered_qty: 3,
  }],
} as PurchaseOrder;

describe("PurchaseOrdersPage outstanding demand columns", () => {
  it("shows sortable pre-ordered and backordered qty on the read-only line list", async () => {
    vi.mocked(purchaseOrdersApi.list).mockResolvedValue([purchaseOrder]);
    vi.mocked(preordersApi.getPurchaseOrderSummary).mockResolvedValue({
      po_id: 1,
      allocations: [],
      line_summaries: [],
      availability: [],
    });

    const view = render(<PurchaseOrdersPage />);
    await userEvent.click(await view.findByLabelText("expand row"));

    await waitFor(() => {
      expect(view.getByText("Pre-ordered Qty")).toBeInTheDocument();
      expect(view.getByText("Backordered Qty")).toBeInTheDocument();
    });
    expect(view.getByTitle("Outstanding reserved Woo / NYA pre-order quantity for this product"))
      .toHaveTextContent("3");
    expect(view.getByTitle("Outstanding paid processing quantity waiting on stock"))
      .toHaveTextContent("3");
    expect(view.getByRole("button", { name: /Pre-ordered Qty/ })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /Backordered Qty/ })).toBeInTheDocument();
    expect(view.getByTestId("po-readonly-line-table")).toHaveClass("MuiTable-stickyHeader");
    expect(view.getByTestId("po-readonly-line-table-container")).toHaveStyle({ maxHeight: "65vh" });
  });
});
