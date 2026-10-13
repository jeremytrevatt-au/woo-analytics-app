import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { purchaseOrderSheetExportMessage, purchaseOrderSheetLinkPatch, purchaseOrdersApi } from "./purchaseOrdersApi";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

const validReceiptResponse = {
  po_id: 19,
  po_number: "PO-19",
  current_status: "received",
  target_status: "received",
  dry_run: false,
  receipt_id: 14,
  lines: [],
  eligible_orders: [],
  reserve_orders: [],
  blocked_orders: [],
  blocking_errors: [],
  processed_order_ids: [],
  reserve_invoice_results: {
    invoiced_order_ids: [],
    balance_order_ids: [],
    errors: [],
  },
};

describe("purchaseOrdersApi.receiveStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the structured no-Reserve receipt response", async () => {
    vi.mocked(fetchJson).mockResolvedValue(validReceiptResponse);

    await expect(
      purchaseOrdersApi.receiveStock(19, { dry_run: false, book_stock: true }),
    ).resolves.toEqual(validReceiptResponse);
  });

  it("rejects the legacy array Reserve result before it can crash the page", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      ...validReceiptResponse,
      reserve_invoice_results: [],
    });

    await expect(
      purchaseOrdersApi.receiveStock(19, { dry_run: false, book_stock: true }),
    ).rejects.toThrow("Invalid receive-stock response field: reserve_invoice_results");
  });
});

describe("purchaseOrdersApi.uploadSupplierInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the PDF through fetchJson so the debug panel can summarise it", async () => {
    const file = new File(["%PDF-1.4"], "invoice.pdf", { type: "application/pdf" });
    vi.mocked(fetchJson).mockResolvedValue({
      purchase_order_id: 4,
      supplier_invoice_url: "https://drive.google.com/file/d/inv/view",
      supplier_invoice_link: "https://drive.google.com/file/d/inv/view",
      supplier_invoice_link_saved: true,
      supplier_invoice_replaced: false,
      folder_created: true,
      drive_link: "https://drive.google.com/drive/folders/folder",
    });

    await purchaseOrdersApi.uploadSupplierInvoice(4, file);

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/purchase-orders/4/supplier-invoice",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
    const init = vi.mocked(fetchJson).mock.calls[0][1] as RequestInit;
    const body = init.body as FormData;
    const uploaded = body.get("file");
    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe("invoice.pdf");
    expect((uploaded as File).type).toBe("application/pdf");
  });
});

describe("purchaseOrderSheetExportMessage", () => {
  it("reports when the sheet is saved in the purchase order folder", () => {
    expect(purchaseOrderSheetExportMessage({
      purchase_order_id: 4,
      audience: "internal",
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/abc/edit",
      spreadsheet_id: "abc",
      sheet_link_saved: true,
      sheet_link: "https://docs.google.com/spreadsheets/d/abc/edit",
      supplier_sheet_link_saved: false,
      supplier_sheet_link: "",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 2,
    })).toBe("Google Sheet created in the purchase order Drive folder.");
  });

  it("reports when the sheet link was not saved", () => {
    expect(purchaseOrderSheetExportMessage({
      purchase_order_id: 4,
      audience: "internal",
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/abc/edit",
      spreadsheet_id: "abc",
      sheet_link_saved: false,
      sheet_link: "",
      supplier_sheet_link_saved: false,
      supplier_sheet_link: "",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 2,
    })).toBe("Google Sheet created, but its link was not saved on the purchase order.");
  });

  it("reports the supplier sheet separately", () => {
    expect(purchaseOrderSheetExportMessage({
      purchase_order_id: 4,
      audience: "supplier",
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/supplier/edit",
      spreadsheet_id: "supplier",
      sheet_link_saved: false,
      sheet_link: "",
      supplier_sheet_link_saved: true,
      supplier_sheet_link: "https://docs.google.com/spreadsheets/d/supplier/edit",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 2,
    }, "supplier")).toBe("Supplier Google Sheet created in the purchase order Drive folder.");
  });
});

describe("purchaseOrderSheetLinkPatch", () => {
  it("updates the internal sheet link without replacing the purchase order", () => {
    expect(purchaseOrderSheetLinkPatch("internal", {
      purchase_order_id: 20,
      audience: "internal",
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/internal/edit",
      spreadsheet_id: "internal",
      sheet_link_saved: true,
      sheet_link: "https://docs.google.com/spreadsheets/d/internal/edit",
      supplier_sheet_link_saved: false,
      supplier_sheet_link: "",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 1,
    })).toEqual({
      sheet_link: "https://docs.google.com/spreadsheets/d/internal/edit",
      drive_link: "https://drive.google.com/drive/folders/folder",
    });
  });

  it("updates the supplier sheet link", () => {
    expect(purchaseOrderSheetLinkPatch("supplier", {
      purchase_order_id: 20,
      audience: "supplier",
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/supplier/edit",
      spreadsheet_id: "supplier",
      sheet_link_saved: false,
      sheet_link: "",
      supplier_sheet_link_saved: true,
      supplier_sheet_link: "https://docs.google.com/spreadsheets/d/supplier/edit",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 1,
    })).toEqual({
      supplier_sheet_link: "https://docs.google.com/spreadsheets/d/supplier/edit",
      drive_link: "https://drive.google.com/drive/folders/folder",
    });
  });
});
