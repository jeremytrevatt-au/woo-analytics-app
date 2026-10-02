import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import {
  getCustomerJourney,
  getVisitorJourney,
  MalformedJourneyResponseError,
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
});
