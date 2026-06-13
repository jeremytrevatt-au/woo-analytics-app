import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FiltersProvider from "./FiltersProvider";
import FilterBar from "./FilterBar";

describe("FilterBar", () => {
  it("updates search input", async () => {
    const user = userEvent.setup();
    render(
      <FiltersProvider>
        <FilterBar />
      </FiltersProvider>
    );

    const searchInput = screen.getByLabelText("Search product, customer, SKU");
    await user.type(searchInput, "seaweed");
    expect(searchInput).toHaveValue("seaweed");
  });
});
