import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCustomerJourney, getVisitorJourney, MalformedJourneyResponseError } from "../api/journeyApi";
import { ApiRequestError } from "../api/httpClient";
import { JourneyResponse } from "../types/journey";
import VisitorJourneyPanel from "./VisitorJourneyPanel";

vi.mock("../api/journeyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/journeyApi")>();
  return {
    ...actual,
    getCustomerJourney: vi.fn(),
    getVisitorJourney: vi.fn(),
  };
});

const journey: JourneyResponse = {
  profile: {
    visitor_id: "visitor-1",
    customer_id: 42,
    stage: "checkout_intent",
    score: 87,
    confidence: "high",
    reason_codes: ["repeat_product_view", "checkout_started"],
    event_counts: { product_view: 3, checkout_started: 1 },
    last_context: "checkout",
    last_object_id: 99,
    first_seen_at: "2026-10-01T00:00:00Z",
    last_seen_at: "2026-10-01T02:00:00Z",
    expires_at: "2026-11-01T00:00:00Z",
  },
  events: [
    {
      event_id: "event-2",
      event_type: "checkout_started",
      occurred_at: "2026-10-01T02:00:00Z",
      context: { type: "checkout", object_id: 99 },
      intent: {
        stage: "checkout_intent",
        score: 87,
        confidence: "high",
        reason_codes: ["checkout_started"],
      },
    },
    {
      event_id: "event-1",
      event_type: "product_view",
      occurred_at: "2026-10-01T01:00:00Z",
      context: { type: "product", object_id: 12 },
      intent: {
        stage: "considering",
        score: 50,
        confidence: "medium",
        reason_codes: ["repeat_product_view"],
      },
    },
  ],
};

describe("VisitorJourneyPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("prefers visitor lookup and renders linked customer, reasons, counts, and timeline", async () => {
    vi.mocked(getVisitorJourney).mockResolvedValue(journey);

    const view = render(
      <VisitorJourneyPanel visitorId="visitor-1" customerId={42} defaultExpanded />,
    );

    expect(await view.findByText("WooCommerce #42")).toBeInTheDocument();
    expect(view.getAllByText("repeat product view").length).toBeGreaterThan(0);
    expect(view.getByText("product view: 3")).toBeInTheDocument();
    expect(view.getAllByText("checkout started").length).toBeGreaterThan(0);
    expect(view.getByLabelText("Journey timeline")).toHaveTextContent("product view");
    expect(getVisitorJourney).toHaveBeenCalledWith("visitor-1");
    expect(getCustomerJourney).not.toHaveBeenCalled();
  });

  it("falls back to customer lookup when visitor identity is absent", async () => {
    vi.mocked(getCustomerJourney).mockResolvedValue(journey);

    render(<VisitorJourneyPanel customerId={42} defaultExpanded />);

    await waitFor(() => expect(getCustomerJourney).toHaveBeenCalledWith(42));
    expect(getVisitorJourney).not.toHaveBeenCalled();
  });

  it("falls back to the linked customer when the visitor journey is not found", async () => {
    vi.mocked(getVisitorJourney).mockRejectedValue(
      new ApiRequestError("Not found", 404, "/journey", null),
    );
    vi.mocked(getCustomerJourney).mockResolvedValue(journey);

    render(<VisitorJourneyPanel visitorId="visitor-1" customerId={42} defaultExpanded />);

    await waitFor(() => expect(getCustomerJourney).toHaveBeenCalledWith(42));
  });

  it("shows loading and then a no-journey 404 state", async () => {
    let rejectRequest!: (reason: unknown) => void;
    vi.mocked(getVisitorJourney).mockReturnValue(new Promise((_, reject) => {
      rejectRequest = reject;
    }));

    const view = render(<VisitorJourneyPanel visitorId="visitor-1" defaultExpanded />);
    expect(view.getByText(/Loading journey/)).toBeInTheDocument();

    rejectRequest(new ApiRequestError("Not found", 404, "/journey", null));
    expect(await view.findByText(/No journey has been recorded/)).toBeInTheDocument();
  });

  it("shows API failures without removing the surrounding panel", async () => {
    vi.mocked(getVisitorJourney).mockRejectedValue(new Error("Service unavailable"));

    const view = render(<VisitorJourneyPanel visitorId="visitor-1" defaultExpanded />);

    expect(await view.findByText("Service unavailable")).toBeInTheDocument();
    expect(view.getByText("Operator journey & intent")).toBeInTheDocument();
  });

  it("reports malformed or partial responses safely", async () => {
    vi.mocked(getVisitorJourney).mockRejectedValue(
      new MalformedJourneyResponseError(["profile.stage must be a string"]),
    );

    const view = render(<VisitorJourneyPanel visitorId="visitor-1" defaultExpanded />);

    expect(await view.findByText(/response was incomplete or malformed/)).toBeInTheDocument();
    expect(view.getByText("Observation only")).toBeInTheDocument();
  });
});
