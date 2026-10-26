import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderAutoOrderDialog from "./PurchaseOrderAutoOrderDialog";

describe("PurchaseOrderAutoOrderDialog", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("requires a positive integer and remembers the last session value", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const view = render(
      <PurchaseOrderAutoOrderDialog open onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    expect(view.getByRole("button", { name: "Apply recommended qty" })).toBeDisabled();
    await user.type(await view.findByLabelText("Days of cover required"), "30");
    await user.click(view.getByRole("button", { name: "Apply recommended qty" }));
    expect(onConfirm).toHaveBeenCalledWith(30);

    view.unmount();
    const again = render(
      <PurchaseOrderAutoOrderDialog open onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(await again.findByLabelText("Days of cover required")).toHaveValue(30);
  });
});
