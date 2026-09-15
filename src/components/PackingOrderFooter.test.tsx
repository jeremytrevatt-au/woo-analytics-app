import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PackingOrderFooter from "./PackingOrderFooter";

describe("PackingOrderFooter", () => {
  afterEach(cleanup);

  it("renders totals and the selected shipping method in the left column", () => {
    const view = render(
      <PackingOrderFooter
        subtotal={100}
        shipping={12.5}
        total={112.5}
        shippingMethod="Australia Post Parcel Post"
        currentStatus="unpacked"
        isSaving={false}
        canChangePackingStatus
        onDimensions={vi.fn()}
        onCrm={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(view.getByText("Subtotal: $100")).toBeInTheDocument();
    expect(view.getByText("Shipping: $13")).toBeInTheDocument();
    expect(view.getByText("Total: $113")).toBeInTheDocument();
    expect(view.getByText("Australia Post Parcel Post")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "L W H" })).toBeInTheDocument();
  });

  it("keeps CRM and packing actions functional", () => {
    const onCrm = vi.fn();
    const onStatusChange = vi.fn();
    const view = render(
      <PackingOrderFooter
        subtotal={100}
        shipping={0}
        total={100}
        shippingMethod="Couriers Please"
        currentStatus="packing"
        isSaving={false}
        canChangePackingStatus
        onDimensions={vi.fn()}
        onCrm={onCrm}
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "CRM" }));
    fireEvent.click(view.getByRole("button", { name: "Packed" }));

    expect(onCrm).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalledWith("packed", expect.anything());
  });
});
