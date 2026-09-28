import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCart,
  getCartsSummary,
  getLatestCustomerCart,
  getLatestVisitorCart,
  listCartRecoveryCandidates,
  listCarts,
} from "./cartsApi";
import { fetchJson } from "./httpClient";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

describe("cartsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockResolvedValue({});
  });

  it("builds list, summary, and recovery requests through fetchJson", async () => {
    await listCarts({ status: "abandoned", page: 2, perPage: 25 });
    await getCartsSummary();
    await listCartRecoveryCandidates({ page: 3, perPage: 10 });

    expect(fetchJson).toHaveBeenNthCalledWith(
      1,
      "/api/v1/carts?page=2&per_page=25&status=abandoned",
    );
    expect(fetchJson).toHaveBeenNthCalledWith(2, "/api/v1/carts/summary");
    expect(fetchJson).toHaveBeenNthCalledWith(
      3,
      "/api/v1/carts/recovery-candidates?page=3&per_page=10",
    );
  });

  it("encodes opaque identifiers in authoritative lookup routes", async () => {
    await getCart("cart/id");
    await getLatestCustomerCart(42);
    await getLatestVisitorCart("visitor/id");

    expect(fetchJson).toHaveBeenNthCalledWith(1, "/api/v1/carts/cart%2Fid");
    expect(fetchJson).toHaveBeenNthCalledWith(
      2,
      "/api/v1/carts/latest/customer/42",
    );
    expect(fetchJson).toHaveBeenNthCalledWith(
      3,
      "/api/v1/carts/latest/visitor/visitor%2Fid",
    );
  });
});
