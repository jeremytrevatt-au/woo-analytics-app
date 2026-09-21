import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecentWebAudits,
  getSiteHealthOverview,
  runWebAudit,
  SiteHealthOverview,
  WebAuditRecord,
} from "../api/siteHealthApi";
import SiteHealthPage from "./SiteHealthPage";

vi.mock("../api/siteHealthApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/siteHealthApi")>();
  return {
    ...original,
    getRecentWebAudits: vi.fn(),
    getSiteHealthOverview: vi.fn(),
    runWebAudit: vi.fn(),
  };
});

const overview: SiteHealthOverview = {
  scan_id: "scan-wp-123",
  generated_at: "2026-09-21T04:00:00Z",
  collector_version: "1.2.0",
  site: { wordpress_version: "6.8", php_version: "8.3" },
  summary: {
    status: "warning",
    counts: { healthy: 1, unavailable: 1 },
  },
  checks: [
    {
      id: "https",
      category: "security",
      status: "healthy",
      severity: "info",
      title: "HTTPS enabled",
      observed: true,
      expected: true,
      evidence: { url: "https://staging.example.test/" },
      recommendation: null,
    },
    {
      id: "external-cron",
      category: "availability",
      status: "unavailable",
      severity: "warning",
      title: "External cron",
      observed: null,
      expected: "Reachable",
      evidence: "Collector did not return a result",
      recommendation: "Check collector access.",
    },
  ],
  host_collector: {
    scan_id: "host-scan-123",
    generated_at: "2026-09-21T04:01:00Z",
    collector_version: "1.0.0",
    site: { host: "staging.example.test", environment: "staging" },
    summary: {
      status: "healthy",
      counts: { healthy: 1 },
    },
    checks: [
      {
        id: "host_disk",
        category: "host",
        status: "healthy",
        severity: "info",
        title: "Host disk",
        observed: { used_percent: 42 },
        expected: { warning_above_percent: 80 },
        evidence: {},
        recommendation: "No action required.",
      },
    ],
    source: { instance_name: "staging-host" },
  },
  external_collectors: {
    google_web_performance: {
      status: "configured",
      providers: ["pagespeed_insights_v5", "crux_query_record"],
      allowlisted_hosts: ["staging.example.test"],
    },
    persistence: {
      status: "configured",
      table: "site_health_web_audits",
      environment: "staging",
    },
  },
};

const audit: WebAuditRecord = {
  audit_id: "audit-google-456",
  requested_at: "2026-09-21T04:04:00Z",
  completed_at: "2026-09-21T04:05:00Z",
  url: "https://staging.example.test/",
  url_host: "staging.example.test",
  strategy: "desktop",
  categories: ["performance", "seo"],
  status: "partial",
  request_id: "request-789",
  collectors: {
    psi: {
      status: "available",
      categories: {
        performance: { title: "Performance", score: 0.91 },
        seo: { title: "SEO", score: 0.98 },
      },
      lab_metrics: { LCP: { title: "Largest Contentful Paint", display_value: "2.1 s", value: 2100 } },
      actionable_audits: [{ id: "unused-js", title: "Reduce unused JavaScript", display_value: "120 KiB" }],
      lighthouse_version: "12.8.0",
      fetch_time: "2026-09-21T04:05:00Z",
      error: "Accessibility category was unavailable.",
    },
    crux: {
      status: "partial",
      records: {
        page: {
          status: "available",
          metrics: {
            LCP: {
              percentiles: { p75: 2400 },
              histogram: [{ start: 0, end: 2500, density: 0.8 }],
            },
          },
          collection_period: { start: "2026-08-24", end: "2026-09-20" },
        },
        origin: {
          status: "no_data",
          metrics: {},
          collection_period: null,
        },
      },
    },
  },
};

describe("SiteHealthPage", () => {
  beforeEach(() => {
    vi.mocked(getSiteHealthOverview).mockResolvedValue(overview);
    vi.mocked(getRecentWebAudits).mockResolvedValue({ audits: [], limit: 10 });
    vi.mocked(runWebAudit).mockResolvedValue(audit);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders report statuses and sends the selected audit payload before rendering PSI and CrUX", async () => {
    render(<SiteHealthPage />);

    expect(await screen.findByText("HTTPS enabled")).toBeInTheDocument();
    expect(screen.getByText("External cron")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Host disk")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /External cron/ }));
    expect(await screen.findByText("Collector did not return a result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Accessibility" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Best practices" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Google Audit" }));

    await waitFor(() => {
      expect(runWebAudit).toHaveBeenCalledWith({
        url: "https://staging.example.test/",
        strategy: "desktop",
        categories: ["performance", "seo"],
      });
    });
    expect((await screen.findAllByText("audit-google-456", { exact: false })).length).toBeGreaterThan(0);
    expect(screen.getByText("Reduce unused JavaScript", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Collection period: 2026-08-24 to 2026-09-20")).toBeInTheDocument();
    expect(screen.getByText("Origin CrUX status: no data")).toBeInTheDocument();
    expect(screen.getByText(/Request ID: request-789/)).toBeInTheDocument();
  });

  it("shows API errors without presenting fabricated health data", async () => {
    vi.mocked(getSiteHealthOverview).mockRejectedValue(new Error("503 collector unavailable"));

    render(<SiteHealthPage />);

    expect(await screen.findByText(/WordPress health request failed: 503 collector unavailable/)).toBeInTheDocument();
    expect(screen.getByText("No WordPress health report loaded.")).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });
});
