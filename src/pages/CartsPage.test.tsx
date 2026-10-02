import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCart,
  getCartsSummary,
  listCartRecoveryCandidates,
  listCarts,
} from "../api/cartsApi";
import CartsPage from "./CartsPage";

vi.mock("../api/cartsApi", () => ({
  getCart: vi.fn(),
  getCartsSummary: vi.fn(),
  getLatestCustomerCart: vi.fn(),
  getLatestVisitorCart: vi.fn(),
  listCartRecoveryCandidates: vi.fn(),
  listCarts: vi.fn(),
}));

const cart = {
  cart_id: "11111111-2222-4333-8444-555555555555",
  visitor_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  customer_analytics_key: "a".repeat(64),
  is_marketing_eligible: true,
  sequence: 3,
  status: "active" as const,
  occurred_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T10:00:00Z",
  currency: "AUD",
  item_count: 1,
  subtotal: 10,
  discount_total: 0,
  shipping_total: 0,
  tax_total: 1,
  total: 11,
  order_id: null,
  is_abandoned: true,
  abandoned_at: "2026-09-28T11:00:00Z",
  is_recovery_eligible: true,
  recovery_eligible_at: "2026-09-28T14:00:00Z",
};

describe("CartsPage", () => {
  beforeEach(() => {
    vi.mocked(getCartsSummary).mockResolvedValue({
      total: 5,
      active: 2,
      checkout_started: 1,
      abandoned: 2,
      recovery_eligible: 1,
      recovery_value: 11,
      suspected_automation: 477,
    });
    vi.mocked(listCarts).mockResolvedValue({
      items: [cart],
      page: 1,
      per_page: 25,
      total: 1,
    });
    vi.mocked(listCartRecoveryCandidates).mockResolvedValue({
      items: [cart],
      page: 1,
      per_page: 25,
      total: 1,
    });
    vi.mocked(getCart).mockResolvedValue({
      ...cart,
      lines: [{
        id: 1,
        product_id: 10,
        variation_id: 0,
        sku: "TEA-1",
        product_name: "Test Tea",
        quantity: 1,
        unit_total: 10,
        line_subtotal: 10,
        line_total: 10,
        metadata: {},
      }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads summary and carts, filters status, and opens authoritative detail", async () => {
    const view = render(<CartsPage />);

    expect(await view.findByText(cart.cart_id)).toBeInTheDocument();
    expect(view.getByText("Identified customer")).toBeInTheDocument();
    expect(view.getByText("Marketing eligible")).toBeInTheDocument();
    expect(view.getByText(/^Abandoned /)).toBeInTheDocument();
    expect(view.getByText(/^Recovery eligible /)).toBeInTheDocument();
    expect(view.getByText(/^Stale · /)).toBeInTheDocument();
    expect(getCartsSummary).toHaveBeenCalled();
    expect(listCarts).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      perPage: 25,
    });

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await view.findByRole("option", { name: "Abandoned" }));
    await waitFor(() => expect(listCarts).toHaveBeenLastCalledWith({
      status: "abandoned",
      page: 1,
      perPage: 25,
    }));
    expect(view.getByText("477")).toBeInTheDocument();

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await view.findByRole("option", { name: "Suspected automation" }));
    await waitFor(() => expect(listCarts).toHaveBeenLastCalledWith({
      status: "suspected_automation",
      page: 1,
      perPage: 25,
    }));

    fireEvent.click(view.getByRole("button", { name: "View" }));
    expect(await view.findByText("Test Tea")).toBeInTheDocument();
    expect(getCart).toHaveBeenCalledWith(cart.cart_id);
  });

  it("loads the dedicated recovery-candidates view", async () => {
    const view = render(<CartsPage />);
    await view.findByText(cart.cart_id);

    fireEvent.click(view.getByRole("button", { name: "Recovery candidates" }));

    await waitFor(() => expect(listCartRecoveryCandidates).toHaveBeenCalledWith({
      page: 1,
      perPage: 25,
    }));
  });

  it("requests the selected results page", async () => {
    vi.mocked(listCarts).mockResolvedValue({
      items: [cart],
      page: 1,
      per_page: 25,
      total: 30,
    });
    const view = render(<CartsPage />);
    await view.findByText(cart.cart_id);

    fireEvent.click(view.getByRole("button", { name: "Go to page 2" }));

    await waitFor(() => expect(listCarts).toHaveBeenLastCalledWith({
      status: undefined,
      page: 2,
      perPage: 25,
    }));
  });
});
