import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { bookPackingShippitOrder, printPackingShippitLabel } from "./shippitPackingApi";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

describe("shippitPackingApi shipment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("books a packing order through the instrumented JSON client", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ can_book: false, can_print_label: true });

    await bookPackingShippitOrder(107);

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/shippit/packing/order/107/book",
      { method: "POST" },
    );
  });

  it("prints an available label through the instrumented JSON client", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ can_print_label: true });

    await printPackingShippitLabel(107);

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/shippit/packing/order/107/print-label",
      { method: "POST" },
    );
  });
});
