import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PackingStockDisplay from "./PackingStockDisplay";

describe("PackingStockDisplay", () => {
  it("uses a fixed-width left-aligned display and opens from its own element", () => {
    const onOpen = vi.fn();
    const view = render(
      <PackingStockDisplay
        reportedStockQty={5}
        adjustedStockQty={10}
        backgroundColor="#fff"
        color="#111"
        onOpen={onOpen}
      />,
    );

    const display = view.getByRole("button", { name: "Stock / Adj: 5 / 10" });
    expect(display).toHaveStyle({
      width: "120px",
      alignItems: "flex-start",
      textAlign: "left",
    });

    fireEvent.click(display);
    expect(onOpen).toHaveBeenCalledWith(display, expect.anything());
  });
});
