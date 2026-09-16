import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import FiltersProvider from "./FiltersProvider";
import FilterBar from "./FilterBar";

vi.mock("../api/analyticsApi", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}));

describe("FilterBar", () => {
  afterEach(cleanup);

  it("updates search input", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <FiltersProvider>
          <FilterBar />
        </FiltersProvider>
      </MemoryRouter>
    );

    const searchInput = screen.getByLabelText("Search order, customer, SKU");
    await user.type(searchInput, "seaweed");
    expect(searchInput).toHaveValue("seaweed");
  });

  it("does not render conflicting product and SKU fields on Stock", () => {
    render(
      <MemoryRouter initialEntries={["/stock?tab=items"]}>
        <FiltersProvider>
          <FilterBar />
        </FiltersProvider>
      </MemoryRouter>
    );

    expect(screen.queryByLabelText("Search product or SKU")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SKU Starts With")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SKU Contains")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SKU Ends With")).not.toBeInTheDocument();
  });
});
