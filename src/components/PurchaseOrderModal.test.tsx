import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    preordered_qty: 12,
    backordered_qty: 3,
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
    expect(view.getByText("Pre-ordered Qty")).toBeInTheDocument();
    expect(view.getByTitle("Outstanding reserved Woo / NYA pre-order quantity for this product"))
      .toHaveTextContent("12");
    expect(view.getByText("Backordered Qty")).toBeInTheDocument();
    expect(view.getByTitle("Outstanding paid processing quantity waiting on stock"))
      .toHaveTextContent("3");
    expect(view.getByText("Days of Cover")).toBeInTheDocument();
    expect(view.getByTitle(/Average daily usage 2/)).toHaveTextContent("24.4");
    expect(view.getByText("Needs Reorder")).toBeInTheDocument();
    expect(view.getByTitle("Compared with 90-day effective lead time"))
      .toHaveTextContent("Yes");
    expect(view.getByTestId("po-edit-line-table")).toHaveClass("MuiTable-stickyHeader");
    expect(view.getByTestId("po-edit-line-table-container")).toHaveStyle({ maxHeight: "65vh" });
  });
});

describe("PurchaseOrderModal apply", () => {
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
    const getPurchaseOrder = vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(purchaseOrder);
    getPurchaseOrder.mockClear();

    const view = render(
      <PurchaseOrderModal open onClose={onClose} onApplied={vi.fn()} po={purchaseOrder} />,
    );
    await user.click(view.getByRole("button", { name: "Save" }));

    expect(onClose).toHaveBeenCalledWith(true);
    expect(purchaseOrdersApi.get).not.toHaveBeenCalled();
  });
});

describe("PurchaseOrderModal supplier invoice", () => {
  it("keeps the uploaded invoice and folder links in the save payload", async () => {
    const user = userEvent.setup();
    const invoiceLink = "https://drive.google.com/file/d/inv/view";
    const driveLink = "https://drive.google.com/drive/folders/new-folder";
    vi.spyOn(purchaseOrdersApi, "uploadSupplierInvoice").mockResolvedValue({
      purchase_order_id: 1,
      supplier_invoice_url: invoiceLink,
      supplier_invoice_link: invoiceLink,
      supplier_invoice_link_saved: true,
      supplier_invoice_replaced: false,
      folder_created: true,
      drive_link: driveLink,
    });
    vi.spyOn(purchaseOrdersApi, "update").mockImplementation(async (_id, payload) => ({
      ...purchaseOrder,
      ...payload,
      id: 1,
    }));
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue({
      ...purchaseOrder,
      drive_link: driveLink,
      supplier_invoice_link: invoiceLink,
    });

    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={purchaseOrder} />,
    );
    const file = new File(["%PDF-1.4"], "supplier-original.pdf", { type: "application/pdf" });
    await user.upload(view.getByTestId("supplier-invoice-file"), file);

    expect(await view.findByRole("link", { name: "Open supplier invoice" })).toHaveAttribute("href", invoiceLink);
    expect(view.getByLabelText("Supplier invoice")).toHaveValue(invoiceLink);
    expect(view.getByLabelText("Google Drive Folder")).toHaveValue(driveLink);
    expect(view.getByRole("button", { name: "Replace supplier invoice" })).toBeEnabled();

    await user.click(view.getByRole("button", { name: "Apply" }));
    expect(purchaseOrdersApi.update).toHaveBeenCalledWith(1, expect.objectContaining({
      supplier_invoice_link: invoiceLink,
      drive_link: driveLink,
    }));
    expect(view.getByLabelText("Supplier invoice")).toHaveValue(invoiceLink);
    expect(view.getByLabelText("Google Drive Folder")).toHaveValue(driveLink);
  });

  it("disables upload until the purchase order has been saved", () => {
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />,
    );

    expect(view.getByRole("button", { name: "Upload supplier invoice" })).toBeDisabled();
  });
});

describe("PurchaseOrderModal auto order", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  const autoOrderPo = {
    ...purchaseOrder,
    supplier_id: 2,
    supplier_name: "GreenStalk",
    lead_time_days: 0,
    lines: [
      {
        id: 11,
        product_id: 11,
        sku: "ENOUGH",
        product_name: "Covered",
        qty: 9,
        avg_daily_usage: 2,
        stock_qty: 80,
        backordered_qty: 0,
        preordered_qty: 0,
        effective_lead_time_days: 10,
      },
      {
        id: 12,
        product_id: 12,
        sku: "SHORT",
        product_name: "Short stock",
        qty: 9,
        avg_daily_usage: 2,
        stock_qty: 10,
        backordered_qty: 0,
        preordered_qty: 0,
        effective_lead_time_days: 10,
      },
      {
        id: 13,
        product_id: 13,
        sku: "BACKORDER",
        product_name: "No demand",
        qty: 9,
        avg_daily_usage: 0,
        stock_qty: 40,
        days_of_cover: 0,
        backordered_qty: 5,
        preordered_qty: 0,
      },
      {
        id: 14,
        product_id: 14,
        sku: "GS-MISSING-LEAD",
        product_name: "GreenStalk missing lead",
        qty: 9,
        avg_daily_usage: 1,
        stock_qty: 0,
        backordered_qty: 0,
        preordered_qty: 0,
      },
    ],
  } as PurchaseOrder;

  it("writes recommended qty for every line and greens only positive recommendations", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(purchaseOrdersApi, "update");
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={autoOrderPo} />,
    );

    await user.click(view.getByRole("button", { name: "Auto Order" }));
    await user.type(await view.findByLabelText("Days of cover required"), "20");
    await user.click(view.getByRole("button", { name: "Apply recommended qty" }));
    await waitFor(() => {
      expect(view.queryByRole("dialog", { name: "Auto Order" })).not.toBeInTheDocument();
    });

    const enough = view.getByRole("spinbutton", { name: "Qty for ENOUGH" });
    const short = view.getByRole("spinbutton", { name: "Qty for SHORT" });
    const backorder = view.getByRole("spinbutton", { name: "Qty for BACKORDER" });
    const greenstalk = view.getByRole("spinbutton", { name: "Qty for GS-MISSING-LEAD" });

    expect(enough).toHaveValue(0);
    expect(enough).toHaveAttribute("data-auto-ordered", "false");
    expect(short).toHaveValue(50);
    expect(short).toHaveAttribute("data-auto-ordered", "true");
    expect(backorder).toHaveValue(5);
    expect(backorder).toHaveAttribute("data-auto-ordered", "true");
    expect(greenstalk).toHaveValue(91);
    expect(greenstalk).toHaveAttribute("data-auto-ordered", "true");
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the green marker when the user edits that qty", async () => {
    const user = userEvent.setup();
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={autoOrderPo} />,
    );

    await user.click(view.getByRole("button", { name: "Auto Order" }));
    await user.type(await view.findByLabelText("Days of cover required"), "20");
    await user.click(view.getByRole("button", { name: "Apply recommended qty" }));
    await waitFor(() => {
      expect(view.queryByRole("dialog", { name: "Auto Order" })).not.toBeInTheDocument();
    });

    const short = view.getByRole("spinbutton", { name: "Qty for SHORT" });
    expect(short).toHaveAttribute("data-auto-ordered", "true");
    await user.clear(short);
    await user.type(short, "12");
    expect(short).toHaveAttribute("data-auto-ordered", "false");
    expect(view.getByRole("spinbutton", { name: "Qty for BACKORDER" })).toHaveAttribute("data-auto-ordered", "true");
  });

  it("does not show Auto Order on a new PO with no lines", () => {
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={null} />,
    );
    expect(view.getByRole("button", { name: "Auto Order" })).toBeDisabled();
  });
});

describe("PurchaseOrderModal line reorder", () => {
  const reorderPo = {
    ...purchaseOrder,
    lines: [
      { id: 21, product_id: 21, sku: "C-SKU", product_name: "Charlie", qty: 1 },
      { id: 22, product_id: 22, sku: "A-SKU", product_name: "Alpha", qty: 2 },
      { id: 23, product_id: 23, sku: "B-SKU", product_name: "Bravo", qty: 3 },
      { id: 24, product_id: 24, sku: "D-SKU", product_name: "Delta", qty: 4 },
    ],
  } as PurchaseOrder;

  it("moves selected lines to the top and saves the new array order with sort_order", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(purchaseOrdersApi, "update").mockResolvedValue(reorderPo);
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(reorderPo);
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={reorderPo} />,
    );

    await user.click(view.getByRole("checkbox", { name: "Select line 1" }));
    await user.click(view.getByRole("checkbox", { name: "Select line 3" }));
    await user.click(view.getByRole("button", { name: "Move to top" }));
    await user.click(view.getByRole("button", { name: "Apply" }));

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      lines: [
        expect.objectContaining({ sku: "C-SKU", sort_order: 1 }),
        expect.objectContaining({ sku: "B-SKU", sort_order: 2 }),
        expect.objectContaining({ sku: "A-SKU", sort_order: 3 }),
        expect.objectContaining({ sku: "D-SKU", sort_order: 4 }),
      ],
    }));
  });

  it("sorts all lines by Woo SKU even when some rows are selected", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(purchaseOrdersApi, "update").mockResolvedValue(reorderPo);
    vi.spyOn(purchaseOrdersApi, "get").mockResolvedValue(reorderPo);
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={reorderPo} />,
    );

    await user.click(view.getByRole("checkbox", { name: "Select line 1" }));
    await user.click(view.getByRole("button", { name: "Sort by SKU" }));
    await user.click(view.getByRole("button", { name: "Apply" }));

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      lines: [
        expect.objectContaining({ sku: "A-SKU", sort_order: 1 }),
        expect.objectContaining({ sku: "B-SKU", sort_order: 2 }),
        expect.objectContaining({ sku: "C-SKU", sort_order: 3 }),
        expect.objectContaining({ sku: "D-SKU", sort_order: 4 }),
      ],
    }));
  });

  it("selects and deselects all visible product lines from the header checkbox", async () => {
    const user = userEvent.setup();
    const view = render(
      <PurchaseOrderModal open onClose={vi.fn()} onApplied={vi.fn()} po={reorderPo} />,
    );

    const header = view.getByRole("checkbox", { name: "Select all visible product lines" });
    await user.click(header);
    expect(view.getByRole("checkbox", { name: "Select line 1" })).toBeChecked();
    expect(view.getByRole("checkbox", { name: "Select line 4" })).toBeChecked();
    await user.click(header);
    expect(view.getByRole("checkbox", { name: "Select line 1" })).not.toBeChecked();
    expect(view.getByRole("button", { name: "Move to top" })).toBeDisabled();
  });
});
