import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import {
  AuditCategory,
  AuditStrategy,
  getRecentWebAudits,
  getSiteHealthOverview,
  runWebAudit,
  SiteHealthOverview,
  WebAuditRecord,
} from "../api/siteHealthApi";
import AuditHistory from "../components/site-health/AuditHistory";
import HostHealthPanel from "../components/site-health/HostHealthPanel";
import WebAuditPanel from "../components/site-health/WebAuditPanel";
import WordPressHealthPanel from "../components/site-health/WordPressHealthPanel";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function configurationText(configuration: unknown): string {
  if (configuration === null || configuration === undefined) return "Not reported by the API.";
  if (typeof configuration === "string") return configuration;
  return JSON.stringify(configuration, null, 2);
}

function allowlistedHostUrl(hosts: string[]): string {
  const host = hosts.find((value) => value.trim().length > 0);
  if (!host) return "";
  const normalizedHost = host.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return normalizedHost ? `https://${normalizedHost}/` : "";
}

export default function SiteHealthPage() {
  const [overview, setOverview] = useState<SiteHealthOverview | null>(null);
  const [history, setHistory] = useState<WebAuditRecord[]>([]);
  const [auditResult, setAuditResult] = useState<WebAuditRecord | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<AuditStrategy>("mobile");
  const [categories, setCategories] = useState<AuditCategory[]>([
    "performance",
    "accessibility",
    "best-practices",
    "seo",
  ]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const response = await getSiteHealthOverview();
      setOverview(response);
      setUrl((current) => current || allowlistedHostUrl(
        response.external_collectors.google_web_performance.allowlisted_hosts,
      ));
    } catch (error) {
      setOverviewError(errorMessage(error));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void getRecentWebAudits(10)
      .then((response) => setHistory(response.audits))
      .catch((error) => setHistoryError(errorMessage(error)));
  }, [loadOverview]);

  const handleRunAudit = async (payload: { url: string; strategy: AuditStrategy; categories: AuditCategory[] }) => {
    setAuditRunning(true);
    setAuditError(null);
    try {
      const result = await runWebAudit(payload);
      setAuditResult(result);
      setHistory((current) => [result, ...current.filter((record) => record.audit_id !== result.audit_id)].slice(0, 10));
    } catch (error) {
      setAuditError(errorMessage(error));
    } finally {
      setAuditRunning(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Site Health</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        WordPress configuration health and explicitly requested Google web quality audits.
      </Typography>

      <Stack spacing={3}>
        {overviewError ? <Alert severity="error">WordPress health request failed: {overviewError}</Alert> : null}
        <WordPressHealthPanel report={overview} loading={overviewLoading} onRefresh={loadOverview} />
        {overview ? <HostHealthPanel report={overview.host_collector} /> : null}

        <Card>
          <CardContent>
            <Typography variant="h6">External collector configuration</Typography>
            <Box
              component="pre"
              sx={{ mb: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "monospace" }}
            >
              {configurationText(overview?.external_collectors)}
            </Box>
          </CardContent>
        </Card>

        {auditError ? <Alert severity="error">Google audit failed: {auditError}</Alert> : null}
        <WebAuditPanel
          url={url}
          strategy={strategy}
          categories={categories}
          running={auditRunning}
          result={auditResult}
          onUrlChange={setUrl}
          onStrategyChange={setStrategy}
          onCategoriesChange={setCategories}
          onRun={handleRunAudit}
        />

        {historyError ? <Alert severity="error">Audit history request failed: {historyError}</Alert> : null}
        <AuditHistory records={history} />
      </Stack>
    </Box>
  );
}
