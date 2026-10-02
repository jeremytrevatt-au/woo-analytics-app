import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { purchaseOrdersApi } from "./purchaseOrdersApi";

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
