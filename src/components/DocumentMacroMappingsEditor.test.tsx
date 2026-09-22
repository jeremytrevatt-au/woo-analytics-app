import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocumentMacroMappingsEditor, {
  DEFAULT_DOCUMENT_MACRO_MAPPING,
} from "./DocumentMacroMappingsEditor";

describe("DocumentMacroMappingsEditor", () => {
  it("edits an allowlisted mapping and adds rows", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DocumentMacroMappingsEditor
        value={[DEFAULT_DOCUMENT_MACRO_MAPPING]}
        onChange={onChange}
      />,
    );

    expect(screen.getByDisplayValue("{firstname}")).toBeInTheDocument();
    expect(screen.getByText("Billing first name")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "{customer_first_name}" },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ token: "{customer_first_name}" }),
    ]);

    rerender(
      <DocumentMacroMappingsEditor
        value={[DEFAULT_DOCUMENT_MACRO_MAPPING]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add mapping" }));
    expect(onChange).toHaveBeenLastCalledWith([
      DEFAULT_DOCUMENT_MACRO_MAPPING,
      expect.objectContaining({ token: "{macro}" }),
    ]);
  });
});
