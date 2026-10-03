import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listJourneys } from "../api/journeyApi";
import VisitorJourneysPage from "./VisitorJourneysPage";

vi.mock("../api/journeyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/journeyApi")>();
  return {
    ...actual,
    listJourneys: vi.fn(),
  };
});

vi.mock("../components/VisitorJourneyPanel", () => ({
  default: ({ visitorId }: { visitorId?: string | null }) => (
    <div>Loaded visitor detail: {visitorId}</div>
  ),
}));

const journey = {
  visitor_id: "visitor-1",
  cart_id: "cart-7",
  customer_id: 42,
  stage: "checkout_intent",
  score: 87,
  confidence: "high" as const,
  reason_codes: ["checkout_started"],
  event_counts: { checkout_started: 1 },
  last_context: "checkout",
  last_object_id: 99,
  first_seen_at: "2026-10-01T00:00:00Z",
  last_seen_at: "2026-10-01T02:00:00Z",
  expires_at: "2026-11-01T00:00:00Z",
};

describe("VisitorJourneysPage", () => {
  beforeEach(() => {
    vi.mocked(listJourneys).mockResolvedValue({
      items: [journey],
      page: 1,
      per_page: 25,
      total: 30,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads ranked journeys with defaults and selects visitor detail", async () => {
    const view = render(<VisitorJourneysPage />);

    expect(await view.findByText("checkout intent")).toBeInTheDocument();
    expect(listJourneys).toHaveBeenCalledWith({
      stage: undefined,
      minScore: 0,
      activeWithinHours: undefined,
      linkage: "all",
      sort: "score_desc",
      page: 1,
      perPage: 25,
    });
    expect(view.getByText("Customer #42 · Cart cart-7")).toBeInTheDocument();
    expect(view.getByText("Observation only")).toBeInTheDocument();

    fireEvent.click(view.getByRole("row", { name: "Visitor journey visitor-1" }));
    expect(view.getByText("Loaded visitor detail: visitor-1")).toBeInTheDocument();
  });

  it("applies filters and resets them to the first page", async () => {
    const view = render(<VisitorJourneysPage />);
    await view.findByText("checkout intent");

    fireEvent.click(view.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ));

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Stage" }));
    fireEvent.click(await view.findByRole("option", { name: "considering" }));
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: "considering", page: 1 }),
    ));

    fireEvent.change(view.getByRole("spinbutton", { name: "Minimum score" }), {
      target: { value: "50" },
    });
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: "considering", minScore: 50, page: 1 }),
    ));

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Activity period" }));
    fireEvent.click(await view.findByRole("option", { name: "Last 3 days" }));
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeWithinHours: 72 }),
    ));

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Linkage" }));
    fireEvent.click(await view.findByRole("option", { name: "Cart linked" }));
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ linkage: "cart" }),
    ));

    fireEvent.mouseDown(view.getByRole("combobox", { name: "Sorting" }));
    fireEvent.click(await view.findByRole("option", { name: "Most recent" }));
    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "recent_desc" }),
    ));
  });

  it("normalizes fractional minimum scores to an integer", async () => {
    const view = render(<VisitorJourneysPage />);
    await view.findByText("checkout intent");

    fireEvent.change(view.getByRole("spinbutton", { name: "Minimum score" }), {
      target: { value: "50.5" },
    });

    await waitFor(() => expect(listJourneys).toHaveBeenLastCalledWith(
      expect.objectContaining({ minScore: 50 }),
    ));
  });

  it("does not let an older request replace newer filtered results", async () => {
    let resolveInitial!: (value: Awaited<ReturnType<typeof listJourneys>>) => void;
    let resolveFiltered!: (value: Awaited<ReturnType<typeof listJourneys>>) => void;
    vi.mocked(listJourneys)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveInitial = resolve;
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFiltered = resolve;
      }));

    const view = render(<VisitorJourneysPage />);
    fireEvent.mouseDown(view.getByRole("combobox", { name: "Stage" }));
    fireEvent.click(await view.findByRole("option", { name: "considering" }));

    resolveFiltered({
      items: [{ ...journey, visitor_id: "visitor-new", stage: "considering" }],
      page: 1,
      per_page: 25,
      total: 1,
    });
    expect(await view.findByRole("row", { name: "Visitor journey visitor-new" }))
      .toBeInTheDocument();

    resolveInitial({
      items: [{ ...journey, visitor_id: "visitor-old" }],
      page: 1,
      per_page: 25,
      total: 1,
    });
    await waitFor(() => {
      expect(view.queryByRole("row", { name: "Visitor journey visitor-old" }))
        .not.toBeInTheDocument();
    });
  });
});
