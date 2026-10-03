import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import {
  getCustomerJourney,
  getVisitorJourney,
  listJourneys,
  MalformedJourneyResponseError,
  parseJourneyListResponse,
  parseJourneyResponse,
} from "./journeyApi";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

const response = {
  profile: {
    visitor_id: "visitor/id",
    stage: "considering",
    score: 72,
    confidence: "medium",
    reason_codes: ["repeat_product_view"],
    event_counts: { product_view: 2 },
    last_context: "product",
    first_seen_at: "2026-10-01T00:00:00Z",
    last_seen_at: "2026-10-01T01:00:00Z",
    expires_at: "2026-11-01T00:00:00Z",
  },
  events: [],
};

describe("journeyApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockResolvedValue(response);
  });

  it("uses encoded visitor and numeric customer paths through fetchJson", async () => {
    await getVisitorJourney("visitor/id");
    await getCustomerJourney(42);

    expect(fetchJson).toHaveBeenNthCalledWith(
      1,
      "/api/v1/journeys/visitor/visitor%2Fid",
    );
    expect(fetchJson).toHaveBeenNthCalledWith(
      2,
      "/api/v1/journeys/customer/42",
    );
  });

  it("rejects partial or malformed payloads instead of trusting a type cast", () => {
    expect(() => parseJourneyResponse({
      profile: { visitor_id: "visitor-1" },
      events: "not-an-array",
    })).toThrow(MalformedJourneyResponseError);
  });

  it("sends canonical list filters through the centralized fetch client", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      items: [response.profile],
      page: 2,
      per_page: 10,
      total: 12,
    });

    await listJourneys({
      stage: "checkout_intent",
      minScore: 45,
      activeWithinHours: 72,
      linkage: "cart",
      sort: "recent_desc",
      page: 2,
      perPage: 10,
    });

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/journeys?min_score=45&linkage=cart&sort=recent_desc&page=2&per_page=10&stage=checkout_intent&active_within_hours=72",
    );
  });

  it("applies canonical list defaults and omits optional filters", async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      items: [],
      page: 1,
      per_page: 25,
      total: 0,
    });

    await listJourneys();

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/v1/journeys?min_score=0&linkage=all&sort=score_desc&page=1&per_page=25",
    );
  });

  it("strictly parses every profile and pagination field in list responses", () => {
    expect(parseJourneyListResponse({
      items: [response.profile],
      page: 1,
      per_page: 25,
      total: 1,
    })).toEqual({
      items: [response.profile],
      page: 1,
      per_page: 25,
      total: 1,
    });

    expect(() => parseJourneyListResponse({
      items: [{ ...response.profile, confidence: "certain" }],
      page: 0,
      per_page: 25.5,
      total: -1,
    })).toThrow(MalformedJourneyResponseError);
  });
});
