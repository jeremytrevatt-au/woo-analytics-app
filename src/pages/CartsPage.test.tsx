import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCart,
  getCartAbandonmentAnalysis,
  getCartsSummary,
  listCartRecoveryCandidates,
  listCarts,
} from "../api/cartsApi";
import CartsPage from "./CartsPage";

vi.mock("../api/cartsApi", () => ({
  getCart: vi.fn(),
  getCartAbandonmentAnalysis: vi.fn(),
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
  recovery_contact_basis: "explicit_consent" as const,
  last_activity_at: "2026-09-28T10:00:00Z",
  last_activity_context: "product",
  last_activity_object_id: 10,
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
    vi.mocked(getCartAbandonmentAnalysis).mockResolvedValue({
      summary: {
        cart_count: 2,
        cart_value: 110,
        converted_cart_count: 1,
        outcome_cart_count: 3,
        abandonment_rate: 0.6667,
      },
      lifecycle_stages: [
        { lifecycle_stage: "checkout_started", cart_count: 1, cart_value: 70 },
      ],
      last_location_contexts: [
        { context: "product_category", cart_count: 1, cart_value: 70 },
      ],
      value_bands: [
        {
          value_band: "50_to_99",
          cart_count: 1,
          cart_value: 70,
          converted_cart_count: 1,
          outcome_cart_count: 2,
          abandonment_rate: 0.5,
        },
      ],
      top_products: [{
        product_id: 10,
        variation_id: 0,
        sku: "TEA-1",
        name: "Abandoned Tea",
        cart_count: 2,
        converted_cart_count: 1,
        outcome_cart_count: 3,
        abandonment_rate: 0.6667,
        item_count: 3,
        cart_value: 110,
      }],
    });
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

    expect(await view.findByText("Identified customer")).toBeInTheDocument();
    expect(view.getByText("Select a cart")).toBeInTheDocument();
    expect(view.queryByText(cart.cart_id)).not.toBeInTheDocument();
    expect(view.queryByRole("columnheader", { name: "Cart" })).not.toBeInTheDocument();
    expect(view.queryByRole("columnheader", { name: "Marketing" })).not.toBeInTheDocument();
    expect(view.queryByRole("columnheader", { name: "Recovery" })).not.toBeInTheDocument();
    expect(view.getByText("Identified customer")).toBeInTheDocument();
    expect(view.getByText(/^Abandoned \d/)).toBeInTheDocument();
    expect(view.getByText(/^Stale · /)).toBeInTheDocument();
    expect(getCartsSummary).toHaveBeenCalled();
    expect(listCarts).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      perPage: 25,
    });

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await view.findByRole("option", { name: "Active" }));
    await waitFor(() => expect(listCarts).toHaveBeenLastCalledWith({
      status: "active",
      page: 1,
      perPage: 25,
    }));

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
    expect(view.getByText(cart.cart_id)).toBeInTheDocument();
    expect(view.getByText("Explicit marketing consent")).toBeInTheDocument();
    expect(view.getByText(/^Recovery eligible \d/)).toBeInTheDocument();
    expect(getCart).toHaveBeenCalledWith(cart.cart_id);
  });

  it("loads the dedicated recovery-candidates view", async () => {
    const view = render(<CartsPage />);
    await view.findByText("Identified customer");

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
    await view.findByText("Identified customer");

    fireEvent.click(view.getByRole("button", { name: "Go to page 2" }));

    await waitFor(() => expect(listCarts).toHaveBeenLastCalledWith({
      status: undefined,
      page: 2,
      perPage: 25,
    }));
  });

  it("shows analysis loading and displays useful abandonment breakdowns", async () => {
    let resolveAnalysis!: (
      value: Awaited<ReturnType<typeof getCartAbandonmentAnalysis>>,
    ) => void;
    vi.mocked(getCartAbandonmentAnalysis).mockReturnValue(new Promise((resolve) => {
      resolveAnalysis = resolve;
    }));

    const view = render(<CartsPage />);
    expect(view.getByText("Loading abandonment analysis…")).toBeInTheDocument();

    resolveAnalysis({
      summary: {
        cart_count: 3,
        cart_value: 240,
        converted_cart_count: 2,
        outcome_cart_count: 5,
        abandonment_rate: 0.6,
      },
      lifecycle_stages: [
        { lifecycle_stage: "active", cart_count: 2, cart_value: 170 },
      ],
      last_location_contexts: [
        { context: "checkout", cart_count: 2, cart_value: 170 },
      ],
      value_bands: [
        {
          value_band: "100_to_199",
          cart_count: 1,
          cart_value: 150,
          converted_cart_count: 1,
          outcome_cart_count: 2,
          abandonment_rate: 0.5,
        },
      ],
      top_products: [{
        product_id: 22,
        variation_id: 0,
        sku: "COFFEE-1",
        name: "Abandoned Coffee",
        cart_count: 2,
        converted_cart_count: 1,
        outcome_cart_count: 3,
        abandonment_rate: 0.6667,
        item_count: 4,
        cart_value: 180,
      }],
    });

    expect(await view.findByText("Abandoned Coffee")).toBeInTheDocument();
    expect(view.getByText("Lifecycle stage")).toBeInTheDocument();
    expect(view.getByText("Last normalized location")).toBeInTheDocument();
    expect(view.getByText("Value bands")).toBeInTheDocument();
    expect(view.getByText("$100–$199")).toBeInTheDocument();
    expect(view.getByText("60%")).toBeInTheDocument();
    expect(view.getByText("Completed carts in comparison")).toBeInTheDocument();
    expect(getCartAbandonmentAnalysis).toHaveBeenCalledTimes(1);
  });
});
