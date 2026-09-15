import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PackingDocumentsDialog from "./PackingDocumentsDialog";

const template = {
  id: 7,
  name: "New Customer Welcome",
  trigger_type: "new_customer",
  match_value: "",
  google_drive_url: "https://docs.google.com/document/d/example",
  enabled: true,
  notes: "Welcome document",
  created_at: "2026-09-15T00:00:00Z",
  updated_at: "2026-09-15T00:00:00Z",
};

describe("PackingDocumentsDialog", () => {
  it("lists available documents with open and print actions", () => {
    const onPrint = vi.fn();
    render(
      <PackingDocumentsDialog
        order={{ order_id: 123 }}
        templates={[template]}
        printSaving={{}}
        printMessage={null}
        onClose={vi.fn()}
        onPrint={onPrint}
      />,
    );

    expect(screen.getByText("Print documents — Order #123")).toBeInTheDocument();
    expect(screen.getByText("New Customer Welcome")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      template.google_drive_url,
    );

    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(onPrint).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: 123 }),
      template,
      expect.anything(),
    );
  });
});
