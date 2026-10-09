import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  getCart,
  getLatestCustomerCart,
  getLatestVisitorCart,
} from "../api/cartsApi";
import { ApiRequestError } from "../api/httpClient";
import { getCrmCustomerProfile } from "../api/crmApi";
import CartDetail from "./CartDetail";

vi.mock("../api/cartsApi", () => ({
  getCart: vi.fn(),
  getLatestCustomerCart: vi.fn(),
  getLatestVisitorCart: vi.fn(),
}));

vi.mock("../api/crmApi", () => ({
  getCrmCustomerProfile: vi.fn(),
}));

vi.mock("./VisitorJourneyPanel", () => ({
  default: ({ visitorId }: { visitorId?: string | null }) => (
    <div>Journey visitor: {visitorId}</div>
  ),
}));

const cart = {
  cart_id: "11111111-2222-4333-8444-555555555555",
  visitor_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  customer_id: 42,
  is_marketing_eligible: true,
  sequence: 3,
  status: "active" as const,
  updated_at: "2026-09-28T10:00:00Z",
  currency: "AUD",
  item_count: 2,
  subtotal: 20,
  discount_total: 0,
  shipping_total: 5,
  tax_total: 2.5,
  total: 27.5,
  order_id: null,
  lines: [{
    id: 1,
    product_id: 10,
    variation_id: 0,
    sku: "TEA-1",
    product_name: "Test Tea",
    quantity: 2,
    unit_total: 10,
    line_subtotal: 20,
    line_total: 20,
    metadata: {},
  }],
};

describe("CartDetail", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses the opaque cart ID before visitor or customer resolution", async () => {
    vi.mocked(getCart).mockResolvedValue(cart);
    vi.mocked(getCrmCustomerProfile).mockResolvedValue({
      profile: {
        customer_id: 42,
        customer_name: "Taylor Green",
        billing_first_name: "Taylor",
        billing_last_name: "Green",
        order_count: 2,
        lifetime_value: 100,
      },
      profile_extension: {
        id: 1,
        customer_id: 42,
        tags: [],
        flags: [],
        preferred_handling_notes: "",
        last_reviewed_date: null,
        next_follow_up_date: null,
        created_by: 1,
        updated_by: 1,
        created_at: null,
        updated_at: null,
      },
      orders: [],
      notes: [],
    });

    const view = render(
      <MemoryRouter>
        <CartDetail
          cartId={cart.cart_id}
          visitorId={cart.visitor_id}
          customerId={42}
        />
      </MemoryRouter>,
    );

    expect(await view.findByText("Test Tea")).toBeInTheDocument();
    expect(await view.findByRole("link", { name: "Taylor Green" })).toHaveAttribute(
      "href",
      "/customers/42",
    );
    expect(view.getByText("Marketing eligible")).toBeInTheDocument();
    expect(view.getByText(/Stale snapshot:/)).toBeInTheDocument();
    expect(view.getByText("Not classified")).toBeInTheDocument();
    expect(view.getByText("Recovery eligibility not classified")).toBeInTheDocument();
    expect(view.getByText("Not recorded")).toBeInTheDocument();
    expect(view.getByText(`Journey visitor: ${cart.visitor_id}`)).toBeInTheDocument();
    expect(getCart).toHaveBeenCalledWith(cart.cart_id);
    expect(getLatestVisitorCart).not.toHaveBeenCalled();
    expect(getLatestCustomerCart).not.toHaveBeenCalled();
  });

  it("resolves by visitor only when no cart ID exists", async () => {
    vi.mocked(getLatestVisitorCart).mockResolvedValue(cart);

    render(<MemoryRouter><CartDetail visitorId={cart.visitor_id} customerId={42} /></MemoryRouter>);

    await waitFor(() => expect(getLatestVisitorCart).toHaveBeenCalledWith(cart.visitor_id));
    expect(getLatestCustomerCart).not.toHaveBeenCalled();
  });

  it("resolves by customer only when cart and visitor IDs are absent", async () => {
    vi.mocked(getLatestCustomerCart).mockResolvedValue(cart);

    render(<MemoryRouter><CartDetail customerId={42} /></MemoryRouter>);

    await waitFor(() => expect(getLatestCustomerCart).toHaveBeenCalledWith(42));
    expect(getCart).not.toHaveBeenCalled();
    expect(getLatestVisitorCart).not.toHaveBeenCalled();
  });

  it("shows an empty cart when the latest visitor lookup is not found", async () => {
    vi.mocked(getLatestVisitorCart).mockRejectedValue(
      new ApiRequestError(
        "API request failed (404) https://analytics.naturalyield.com.au/api/v1/carts/latest/visitor/x: Not Found",
        404,
        "https://analytics.naturalyield.com.au/api/v1/carts/latest/visitor/x",
        { detail: "Not Found" },
      ),
    );

    const view = render(
      <MemoryRouter>
        <CartDetail visitorId={cart.visitor_id} customerId={42} />
      </MemoryRouter>,
    );

    expect(await view.findByText("No cart is recorded for this visitor.")).toBeInTheDocument();
    expect(view.queryByText(/API request failed/)).not.toBeInTheDocument();
    expect(getLatestCustomerCart).not.toHaveBeenCalled();
  });

  it("still shows a cart id 404 as a failed request", async () => {
    vi.mocked(getCart).mockRejectedValue(
      new ApiRequestError(
        "API request failed (404) https://analytics.naturalyield.com.au/api/v1/carts/missing: Not Found",
        404,
        "https://analytics.naturalyield.com.au/api/v1/carts/missing",
        { detail: "Not Found" },
      ),
    );

    const view = render(
      <MemoryRouter>
        <CartDetail cartId={cart.cart_id} visitorId={cart.visitor_id} />
      </MemoryRouter>,
    );

    expect(await view.findByText(/API request failed \(404\)/)).toBeInTheDocument();
    expect(view.queryByText("No cart is recorded for this visitor.")).not.toBeInTheDocument();
    expect(getLatestVisitorCart).not.toHaveBeenCalled();
  });

  it("shows lookup errors without trying another identity", async () => {
    vi.mocked(getCart).mockRejectedValue(new Error("Cart not found"));

    const view = render(
      <MemoryRouter>
        <CartDetail cartId={cart.cart_id} visitorId={cart.visitor_id} />
      </MemoryRouter>,
    );

    expect(await view.findByText("Cart not found")).toBeInTheDocument();
    expect(getLatestVisitorCart).not.toHaveBeenCalled();
  });
});
