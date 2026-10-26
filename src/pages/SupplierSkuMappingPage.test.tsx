import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api/httpClient";
import type { SkuMappingCandidate, SkuMappingPreview, SkuMappingPreviewRow } from "../api/supplierSkuMappingApi";
import SupplierSkuMappingPage from "./SupplierSkuMappingPage";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  preview: vi.fn(),
  commit: vi.fn(),
}));

vi.mock("../api/suppliersApi", () => ({ suppliersApi: { getAll: mocks.getAll, update: vi.fn() } }));
vi.mock("../api/supplierSkuMappingApi", () => ({
  supplierSkuMappingApi: { preview: mocks.preview, commit: mocks.commit },
}));

function candidate(id: number, overrides: Partial<SkuMappingCandidate> = {}): SkuMappingCandidate {
  return {
    id,
    type: "variation",
    sku: `GS-${id}`,
    status: "publish",
    parent_id: 1,
    parent_name: "Greenstalk Vertical Planter",
    name: "Greenstalk Vertical Planter",
    attributes: [
      { name: "Tier", term_name: "3 Tier" },
      { name: "Style", term_name: "Basic" },
      { name: "Colour", term_name: "Stunning Stone" },
    ],
    label: `Product ${id}`,
    supplier_id: null,
    supplier_sku: "",
    supplier_price: "",
    ...overrides,
  };
}

function row(rowId: number, overrides: Partial<SkuMappingPreviewRow> = {}): SkuMappingPreviewRow {
  return {
    row_id: rowId,
    page: 1,
    supplier_name: `Sheet product ${rowId}`,
    supplier_sku: `SUP-${rowId}`,
    price: "10.00",
    price_flag: "",
    case_qty: null,
    family: "vertical_planter",
    tier: 3,
    style: "Basic",
    colour: "Snow",
    colour_as_sheet: "Snow",
    height: null,
    aliases_applied: [],
    flags: [],
    notes: [],
    warnings: [],
    matched: candidate(100 + rowId),
    candidates: [],
    is_suggestion: false,
    include_default: true,
    base_status: "match",
    status: "match",
    ...overrides,
  };
}

const conflictTarget = candidate(202, { supplier_id: 2, supplier_sku: "OLD", supplier_price: "9.00" });

const previewPayload: SkuMappingPreview = {
  run_id: "run1",
  supplier: { id: 2, name: "GreenStalk", default_currency: "USD" },
  parse: { stats: { data_rows: 4, tbd_prices: 0 }, colour_headers: ["Snow"] },
  totals: {},
  row_count: 4,
  rows: [
    row(1),
    row(2, { matched: conflictTarget, base_status: "conflict", status: "conflict" }),
    row(3, { matched: null, base_status: "no_woo_product", status: "no_woo_product", include_default: false }),
    row(4, { supplier_sku: "SUP-1" }),
  ],
  family_resolution: [
    { family: "vertical_planter", label: "Vertical Planter", resolved: true, problem: null, parent_id: 1, parent_name: "P", parent_sku: "GS-PLANTER", variation_count: 3 },
  ],
  aliases: [{ supplier_value: "Basket", woo_value: "Basket Weave", applies_to: "Style (Woo: Texture)" }],
  candidates: [candidate(101), candidate(202), candidate(303), candidate(555)],
  woo_without_supplier_row: [],
};

async function uploadAndPreview() {
  const user = userEvent.setup();
  render(<SupplierSkuMappingPage />);
  await screen.findByText("Supplier SKU Mapping");
  await waitFor(() => expect(screen.getByRole("combobox")).toHaveTextContent("GreenStalk"));
  expect(screen.queryByTestId("sku-sheet-input")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Preview" }));
  return user;
}

describe("SupplierSkuMappingPage", () => {
  beforeEach(() => {
    mocks.getAll.mockResolvedValue([
      { id: 1, name: "Other Supplier", default_currency: "AUD", contact_name: "", email: "", default_lead_time_days: 0 },
      {
        id: 2,
        name: "GreenStalk",
        default_currency: "USD",
        contact_name: "",
        email: "",
        default_lead_time_days: 0,
        catalog_spreadsheet_id: "1dzQGXFU2ctRqyPvmnzaDyyP0bq51wIqCM7WN9vAI7RI",
        catalog_sheet_tab: "Sheet1",
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("defaults the supplier to GreenStalk and previews the saved sheet without a PDF", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    expect(mocks.preview).toHaveBeenCalledTimes(1);
    expect(mocks.preview.mock.calls[0]).toEqual([2]);
  });

  it("shows the required columns, the Style (Woo: Texture) label and the read-only aliases", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    await uploadAndPreview();
    const table = await screen.findByTestId("sku-mapping-table");
    expect(within(table).getByText("(Woo: Texture)")).toBeInTheDocument();
    for (const heading of ["Supplier SKU", "Supplier name", "Tier", "Colour", "Height", "Matched Woo product", "Current Woo supplier values", "Status", "Action"]) {
      expect(within(table).getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByTestId("alias-table")).toBeInTheDocument();
  });

  it("shows the matched Woo product name, then its attributes by term name, then id, SKU and status", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    const target = within(screen.getByTestId("sku-target-1"));
    expect(target.getByTestId("woo-product-name")).toHaveTextContent("Greenstalk Vertical Planter");
    expect(target.getByTestId("woo-product-attributes")).toHaveTextContent("Tier: 3 Tier, Style: Basic, Colour: Stunning Stone");
    expect(target.getByTestId("woo-product-identity")).toHaveTextContent("#101 / GS-101 / published");
  });

  it("shows a simple product by name only, and a private product as private", async () => {
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      rows: [row(1, { matched: candidate(50, { type: "simple", name: "Ultimate Spinner Base Only", attributes: [], status: "private", sku: "GS-SPINNER-BASE" }) })],
      row_count: 1,
    });
    await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    const target = within(screen.getByTestId("sku-target-1"));
    expect(target.getByTestId("woo-product-name")).toHaveTextContent("Ultimate Spinner Base Only");
    expect(target.queryByTestId("woo-product-attributes")).not.toBeInTheDocument();
    expect(target.getByTestId("woo-product-identity")).toHaveTextContent("#50 / GS-SPINNER-BASE / private");
  });

  it("lists each candidate of an Ambiguous row with name, attributes, id, SKU and status", async () => {
    const candidates = [
      candidate(401, { attributes: [{ name: "Colour", term_name: "Snow" }] }),
      candidate(402, { name: "Greenstalk Garden Lid", attributes: [{ name: "Colour", term_name: "Sage Green" }] }),
    ];
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      rows: [row(5, { matched: null, candidates, base_status: "ambiguous", status: "ambiguous", include_default: false })],
      row_count: 1,
    });
    await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    const list = within(screen.getByTestId("sku-candidates-5"));
    expect(list.getByText("2 candidates:")).toBeInTheDocument();
    expect(list.getByText("Colour: Snow")).toBeInTheDocument();
    expect(list.getByText("Greenstalk Garden Lid")).toBeInTheDocument();
    expect(list.getByText("Colour: Sage Green")).toBeInTheDocument();
    expect(list.getByText("#401 / GS-401 / published")).toBeInTheDocument();
    expect(list.getByText("#402 / GS-402 / published")).toBeInTheDocument();
  });

  it("offers manual-select options by name and attributes, and shows the chosen product's name", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    await user.click(within(screen.getByTestId("sku-row-3")).getByRole("button", { name: "Select" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    const option = await screen.findByRole("option", { name: /#303/ });
    expect(option).toHaveTextContent("Greenstalk Vertical Planter");
    expect(option).toHaveTextContent("Tier: 3 Tier, Style: Basic, Colour: Stunning Stone");
    expect(option).toHaveTextContent("#303 / GS-303 / published");
    await user.click(option);
    await user.click(within(dialog).getByRole("button", { name: "Use this product" }));
    await waitFor(() => expect(within(screen.getByTestId("sku-target-3")).getByTestId("woo-product-name")).toHaveTextContent("Greenstalk Vertical Planter"));
    expect(within(screen.getByTestId("sku-row-3")).getByText("Chosen by hand")).toBeInTheDocument();
  });

  it("flags duplicate Supplier SKUs inside the sheet and blocks them from commit", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    expect(within(screen.getByTestId("sku-row-1")).getByTestId("status-sheet_warning")).toBeInTheDocument();
    expect(within(screen.getByTestId("sku-row-4")).getByTestId("status-sheet_warning")).toBeInTheDocument();
    expect(within(screen.getByTestId("sku-row-1")).getByText(/Cannot commit/)).toBeInTheDocument();
  });

  it("commits only the confirmed rows and lists a result per row", async () => {
    mocks.preview.mockResolvedValue(previewPayload);
    mocks.commit.mockResolvedValue({
      success: true,
      counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
      results: [
        {
          index: 0,
          product_id: 101,
          status: "updated",
          before: { supplier_id: null, supplier_sku: "", supplier_price: "" },
          after: { supplier_id: 2, supplier_sku: "SUP-1-FIXED", supplier_price: "10.00" },
        },
      ],
    });
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");

    // Fix the duplicate by editing row 1's SKU. Row 2 is a conflict (Replace not ticked), row 3 has no product, row 4 is also fixed.
    const rowOneSku = screen.getByLabelText("Supplier SKU for row 1");
    await user.clear(rowOneSku);
    await user.type(rowOneSku, "SUP-1-FIXED");
    const rowFourSku = screen.getByLabelText("Supplier SKU for row 4");
    await user.clear(rowFourSku);
    await user.type(rowFourSku, "SUP-4");
    await user.click(screen.getByLabelText("Include row 4"));

    await user.click(screen.getByRole("button", { name: /^Commit 1 row/ }));
    const counts = await screen.findByTestId("commit-confirm-counts");
    expect(within(counts).getByText("New values to write").nextSibling).toHaveTextContent("1");
    expect(within(counts).getByText(/Skipped: conflict, Replace not ticked/).nextSibling).toHaveTextContent("1");

    // The confirmation names the Woo product each value will be written to.
    const confirmRows = within(screen.getByTestId("commit-confirm-rows"));
    expect(confirmRows.getByText("Greenstalk Vertical Planter")).toBeInTheDocument();
    expect(confirmRows.getByText("Tier: 3 Tier, Style: Basic, Colour: Stunning Stone")).toBeInTheDocument();
    expect(confirmRows.getByText("#101 / GS-101 / published")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Commit 1 row" }));
    const alert = await screen.findByTestId("commit-result-alert");
    expect(alert).toHaveTextContent("Committed 1 rows: updated 1, skipped 0, failed 0");
    // The per-row result ties before/after values to the named product.
    const resultProduct = within(screen.getByTestId("commit-results"));
    expect(resultProduct.getAllByText("Greenstalk Vertical Planter").length).toBeGreaterThan(0);
    expect(resultProduct.getByText("#101 / GS-101 / published")).toBeInTheDocument();
    expect(mocks.commit).toHaveBeenCalledWith([
      { product_id: 101, supplier_id: 2, supplier_sku: "SUP-1-FIXED", supplier_price: "10.00", replace: false },
    ]);
    const results = within(screen.getByTestId("commit-results"));
    expect(results.getByText("Updated")).toBeInTheDocument();
    expect(results.getByText("Skipped: conflict")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Commit 1 row/ })).not.toBeInTheDocument();
  });

  it("shows a sticky alert with server counts and stops offering the same 96 rows after a successful commit", async () => {
    const manyRows = Array.from({ length: 96 }, (_, index) => row(index + 1));
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      row_count: 96,
      rows: manyRows,
      candidates: manyRows.map((entry) => entry.matched!).filter(Boolean),
    });
    mocks.commit.mockResolvedValue({
      success: true,
      counts: { updated: 90, unchanged: 4, conflict_skipped: 1, error: 1 },
      results: manyRows.map((entry, index) => ({
        index,
        product_id: entry.matched!.id,
        status: index === 95 ? "error" : index === 94 ? "conflict_skipped" : index < 90 ? "updated" : "unchanged",
        after:
          index < 94
            ? { supplier_id: 2, supplier_sku: entry.supplier_sku, supplier_price: "10.00" }
            : undefined,
      })),
    });
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    await user.click(screen.getByRole("button", { name: "Commit 96 rows..." }));
    const dialogConfirm = await screen.findByRole("button", { name: "Commit 96 rows" });
    await user.click(dialogConfirm);
    const alert = await screen.findByTestId("commit-result-alert");
    expect(alert).toHaveTextContent("Committed 96 rows: updated 90, skipped 5, failed 1");
    expect(screen.getByTestId("commit-results")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Commit 96 rows/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("sku-commit-page-button")).not.toHaveTextContent("Commit 96 rows");
  });

  it("shows Committing N rows on the page and dialog buttons while commit is in flight", async () => {
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      rows: [row(1)],
      row_count: 1,
    });
    let resolveCommit: (value: unknown) => void = () => undefined;
    mocks.commit.mockReturnValue(
      new Promise((resolve) => {
        resolveCommit = resolve;
      }),
    );
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    await user.click(screen.getByRole("button", { name: "Commit 1 row..." }));
    await user.click(await screen.findByRole("button", { name: "Commit 1 row" }));
    const dialogButton = await screen.findByRole("button", { name: /Committing 1 row/ });
    const pageButton = screen.getByTestId("sku-commit-page-button");
    expect(pageButton).toHaveTextContent("Committing 1 row");
    expect(pageButton).toBeDisabled();
    expect(dialogButton).toBeDisabled();
    resolveCommit({
      success: true,
      counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
      results: [
        {
          index: 0,
          product_id: 101,
          status: "updated",
          after: { supplier_id: 2, supplier_sku: "SUP-1", supplier_price: "10.00" },
        },
      ],
    });
    expect(await screen.findByTestId("commit-result-alert")).toHaveTextContent(
      "Committed 1 rows: updated 1, skipped 0, failed 0",
    );
  });

  it("shows the commit failure in the same sticky alert and includes counts when the server returned them", async () => {
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      rows: [row(1)],
      row_count: 1,
    });
    mocks.commit.mockRejectedValue(
      new ApiRequestError("API request failed (502)", 502, "/api/v1/supplier-sku-mapping/commit", {
        detail: "WordPress Supplier SKU commit failed.",
        counts: { updated: 2, unchanged: 0, conflict_skipped: 0, error: 3 },
      }),
    );
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");
    await user.click(screen.getByRole("button", { name: "Commit 1 row..." }));
    await user.click(await screen.findByRole("button", { name: "Commit 1 row" }));
    const alert = await screen.findByTestId("commit-result-alert");
    expect(alert).toHaveTextContent("The commit failed:");
    expect(alert).toHaveTextContent("WordPress Supplier SKU commit failed.");
    expect(alert).toHaveTextContent("Committed 5 rows: updated 2, skipped 0, failed 3");
  });

  it("shows before and after values before replacing all conflicts, then commits with replace", async () => {
    mocks.preview.mockResolvedValue({
      ...previewPayload,
      rows: [previewPayload.rows[1]],
      row_count: 1,
    });
    mocks.commit.mockResolvedValue({
      success: true,
      counts: { updated: 1, unchanged: 0, conflict_skipped: 0, error: 0 },
      results: [{ index: 0, product_id: 202, status: "updated" }],
    });
    const user = await uploadAndPreview();
    await screen.findByTestId("sku-mapping-table");

    await user.click(screen.getByRole("button", { name: /Replace all conflicts \(1\)/ }));
    const table = await screen.findByTestId("replace-conflicts-table");
    expect(within(table).getByText(/supplier 2 \/ OLD \/ \$9\.00/)).toBeInTheDocument();
    expect(within(table).getByText(/SUP-2 \/ \$10\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tick Replace on these rows" }));

    // The replace dialog fades out first; wait until the page is interactive again.
    await user.click(await screen.findByRole("button", { name: /^Commit 1 row/ }));
    await user.click(await screen.findByRole("button", { name: "Commit 1 row" }));
    await waitFor(() => expect(mocks.commit).toHaveBeenCalled());
    expect(mocks.commit).toHaveBeenCalledWith([
      { product_id: 202, supplier_id: 2, supplier_sku: "SUP-2", supplier_price: "10.00", replace: true },
    ]);
  });

  it("reports a parse failure plainly with every failing row and no preview", async () => {
    mocks.preview.mockRejectedValue(
      new ApiRequestError("API request failed (422)", 422, "/api/v1/supplier-sku-mapping/preview", {
        detail: {
          message: "The GreenStalk sheet could not be parsed completely. Nothing was previewed.",
          failures: [{ page: 2, row_text: "Weird row", reason: "Price is not a dollar amount or TBD" }],
        },
      }),
    );
    await uploadAndPreview();
    const alert = await screen.findByTestId("sku-page-error");
    expect(alert).toHaveTextContent("Nothing was previewed");
    expect(alert).toHaveTextContent("Weird row");
    expect(alert).toHaveTextContent("Price is not a dollar amount or TBD");
    expect(screen.queryByTestId("sku-mapping-table")).not.toBeInTheDocument();
  });
});
