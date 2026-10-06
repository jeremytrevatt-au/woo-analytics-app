import { describe, expect, it } from "vitest";
import { existingPurchaseOrderSheetLink } from "../api/purchaseOrdersApi";
import { creatingSheetTabMarkup, sheetTabErrorMarkup } from "./purchaseOrderSheetTab";

describe("existingPurchaseOrderSheetLink", () => {
  it("uses the internal sheet when one is saved", () => {
    expect(existingPurchaseOrderSheetLink({
      sheet_link: " https://docs.google.com/spreadsheets/d/internal/edit ",
      supplier_sheet_link: "https://docs.google.com/spreadsheets/d/supplier/edit",
    }, "internal")).toBe("https://docs.google.com/spreadsheets/d/internal/edit");
  });

  it("uses the supplier sheet when one is saved", () => {
    expect(existingPurchaseOrderSheetLink({
      sheet_link: "",
      supplier_sheet_link: "https://docs.google.com/spreadsheets/d/supplier/edit",
    }, "supplier")).toBe("https://docs.google.com/spreadsheets/d/supplier/edit");
  });

  it("is empty when that audience has no sheet", () => {
    expect(existingPurchaseOrderSheetLink({ sheet_link: " https://docs.google.com/spreadsheets/d/internal/edit " }, "supplier")).toBe("");
  });
});

describe("creatingSheetTabMarkup", () => {
  it("asks the new tab to open the spreadsheet itself", () => {
    const markup = creatingSheetTabMarkup("token-1");
    expect(markup).toContain("Creating the purchase order Google Sheet");
    expect(markup).toContain("location.replace(url)");
    expect(markup).toContain(JSON.stringify("token-1"));
    expect(markup).not.toContain("about:blank");
  });

  it("shows an export error inside the tab", () => {
    expect(sheetTabErrorMarkup('Sheet "20" failed')).toContain(JSON.stringify('Sheet "20" failed'));
  });
});
