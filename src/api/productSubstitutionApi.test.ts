import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { previewProductSubstitution, substituteProduct } from "./productSubstitutionApi";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

const payload = {
  order_id: 900001,
  order_item_id: 16719,
  replacement_product_id: 113890,
  new_quantity: 5,
};

describe("product substitution API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews through the instrumented JSON client", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ is_preview: true });

    await previewProductSubstitution(payload);

    expect(fetchJson).toHaveBeenCalledWith("/api/v1/packing/product-substitution/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("confirms through the instrumented JSON client", async () => {
    vi.mocked(fetchJson).mockResolvedValue({ packing_status: "unpacked" });

    await substituteProduct(payload);

    expect(fetchJson).toHaveBeenCalledWith("/api/v1/packing/product-substitution", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });
});
