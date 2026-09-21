import { fetchJson } from "./httpClient";

export type SiteHealthStatus = "healthy" | "warning" | "critical" | "unavailable" | "not_applicable";
export type SiteHealthSeverity = "info" | "warning" | "critical";
export type AuditStrategy = "mobile" | "desktop";
export type AuditCategory = "performance" | "accessibility" | "best-practices" | "seo";
export type CollectorStatus = "available" | "unavailable" | "no_data" | "partial" | "error";
export type WebAuditStatus = "complete" | "partial" | "unavailable";

export interface SiteHealthCheck {
  id: string;
  category: string;
  status: SiteHealthStatus;
  severity: SiteHealthSeverity;
  title: string;
  observed: unknown;
  expected: unknown;
  evidence: unknown;
  recommendation: string | null;
}

export interface WordPressHealthReport {
  scan_id: string;
  generated_at: string;
  collector_version: string;
  site: Record<string, unknown>;
  summary: {
    status: SiteHealthStatus;
    counts: Partial<Record<SiteHealthStatus, number>>;
  };
  checks: SiteHealthCheck[];
}

export interface ExternalCollectors {
  google_web_performance: {
    status: "configured" | "unavailable";
    providers: string[];
    allowlisted_hosts: string[];
  };
  persistence: {
    status: "configured" | "unavailable";
    table: string;
    environment: string;
  };
}

export interface SiteHealthOverview extends WordPressHealthReport {
  host_collector: HostHealthReport;
  external_collectors: ExternalCollectors;
}

export interface HostHealthReport {
  status?: "unavailable";
  error?: string;
  scan_id?: string;
  generated_at?: string;
  collector_version?: string;
  site?: Record<string, unknown>;
  summary?: WordPressHealthReport["summary"];
  checks?: SiteHealthCheck[];
  source?: {
    project_id?: string;
    instance_name?: string;
    log_timestamp?: string | null;
  };
}

export interface LighthouseMetric {
  title?: string;
  value?: number | string | null;
  display_value?: string | null;
  unit?: string | null;
  [key: string]: unknown;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score?: number | null;
  display_value?: string | null;
  details?: unknown;
  [key: string]: unknown;
}

export interface PsiCategory {
  title: string;
  score: number | null;
}

export interface PsiCollector {
  status: CollectorStatus;
  categories?: Partial<Record<AuditCategory, PsiCategory>>;
  lab_metrics?: Record<string, LighthouseMetric | number | string | null>;
  actionable_audits?: LighthouseAudit[];
  lighthouse_version?: string | null;
  fetch_time?: string | null;
  error?: string | null;
}

export interface CruxHistogramBucket {
  start?: number;
  end?: number;
  density: number;
}

export interface CruxMetric {
  percentiles: Record<string, number | string | null>;
  histogram: CruxHistogramBucket[];
}

export interface CruxRecord {
  status: CollectorStatus;
  metrics: Record<string, CruxMetric>;
  collection_period?: {
    start?: string | null;
    end?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface CruxCollector {
  status: CollectorStatus;
  records?: {
    page?: CruxRecord;
    origin?: CruxRecord;
  };
  error?: string | null;
}

export interface WebAuditRecord {
  audit_id: string;
  requested_at: string;
  completed_at: string | null;
  url: string;
  url_host: string;
  strategy: AuditStrategy;
  categories: AuditCategory[];
  status: WebAuditStatus;
  collectors: {
    psi: PsiCollector;
    crux: CruxCollector;
  };
  request_id: string | null;
}

export interface RunWebAuditRequest {
  url: string;
  strategy: AuditStrategy;
  categories: AuditCategory[];
}

function isWordPressReport(value: unknown): value is WordPressHealthReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<WordPressHealthReport>;
  return (
    typeof report.scan_id === "string"
    && typeof report.generated_at === "string"
    && !!report.summary
    && Array.isArray(report.checks)
  );
}

export async function getSiteHealthOverview(): Promise<SiteHealthOverview> {
  const response = await fetchJson<SiteHealthOverview>("/api/v1/site-health/overview");
  if (!isWordPressReport(response)) {
    throw new Error("Site Health overview did not contain a valid WordPress report.");
  }
  return response;
}

export function runWebAudit(payload: RunWebAuditRequest): Promise<WebAuditRecord> {
  return fetchJson<WebAuditRecord>("/api/v1/site-health/web-audit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface WebAuditHistoryResponse {
  audits: WebAuditRecord[];
  limit: number;
}

export function getRecentWebAudits(limit = 10): Promise<WebAuditHistoryResponse> {
  return fetchJson<WebAuditHistoryResponse>(
    `/api/v1/site-health/web-audits?limit=${encodeURIComponent(limit)}`,
  );
}
