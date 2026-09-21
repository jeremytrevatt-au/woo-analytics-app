import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./httpClient";
import { getRecentWebAudits, getSiteHealthOverview } from "./siteHealthApi";

vi.mock("./httpClient", () => ({
  fetchJson: vi.fn(),
}));

describe("siteHealthApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the direct WordPress report and exposes external_collectors", async () => {
    const response = {
      scan_id: "scan-1",
      generated_at: "2026-09-21T04:00:00Z",
      collector_version: "1.0.0",
      site: { url: "https://staging.example.test/" },
      summary: { status: "healthy", counts: { healthy: 1 } },
      checks: [],
      host_collector: {
        status: "unavailable",
        error: "No report",
      },
      external_collectors: {
        google_web_performance: {
          allowlisted_hosts: ["staging.example.test"],
          providers: ["pagespeed_insights_v5", "crux_query_record"],
          status: "configured",
        },
        persistence: {
          status: "configured",
          table: "site_health_web_audits",
          environment: "staging",
        },
      },
    };
    vi.mocked(fetchJson).mockResolvedValue(response);

    await expect(getSiteHealthOverview()).resolves.toEqual(response);
    expect(fetchJson).toHaveBeenCalledWith("/api/v1/site-health/overview");
  });

  it("reads audit history from the audits collection", async () => {
    const response = { audits: [], limit: 7 };
    vi.mocked(fetchJson).mockResolvedValue(response);

    await expect(getRecentWebAudits(7)).resolves.toEqual(response);
    expect(fetchJson).toHaveBeenCalledWith("/api/v1/site-health/web-audits?limit=7");
  });
});
