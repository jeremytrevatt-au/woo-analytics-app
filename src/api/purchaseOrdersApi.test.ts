import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { purchaseOrderSheetExportMessage, purchaseOrdersApi } from "./purchaseOrdersApi";

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

describe("purchaseOrderSheetExportMessage", () => {
  it("reports when the sheet is saved in the purchase order folder", () => {
    expect(purchaseOrderSheetExportMessage({
      purchase_order_id: 4,
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/abc/edit",
      spreadsheet_id: "abc",
      sheet_link_saved: true,
      sheet_link: "https://docs.google.com/spreadsheets/d/abc/edit",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 2,
    })).toBe("Google Sheet created in the purchase order Drive folder.");
  });

  it("reports when the sheet link was not saved", () => {
    expect(purchaseOrderSheetExportMessage({
      purchase_order_id: 4,
      spreadsheet_url: "https://docs.google.com/spreadsheets/d/abc/edit",
      spreadsheet_id: "abc",
      sheet_link_saved: false,
      sheet_link: "",
      drive_link: "https://drive.google.com/drive/folders/folder",
      line_count: 2,
    })).toBe("Google Sheet created, but its link was not saved on the purchase order.");
  });
});
