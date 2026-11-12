import { FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  CustomerBan,
  CustomerBanMatchPreview,
  CustomerBanSuspendResult,
  customerBansApi,
} from "../api/customerBansApi";
import { customersSections } from "./customersSections";

const pageSize = 50;

type Draft = {
  name_pattern: string;
  email_pattern: string;
  phone_pattern: string;
  address_pattern: string;
  notes: string;
  is_active: boolean;
};

const emptyDraft = (): Draft => ({
  name_pattern: "",
  email_pattern: "",
  phone_pattern: "",
  address_pattern: "",
  notes: "",
  is_active: true,
});

function patternSummary(ban: CustomerBan): string {
  return [
    ban.name_pattern && `name:${ban.name_pattern}`,
    ban.email_pattern && `email:${ban.email_pattern}`,
    ban.phone_pattern && `phone:${ban.phone_pattern}`,
    ban.address_pattern && `address:${ban.address_pattern}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function SuspendSummary({ result }: { result: CustomerBanSuspendResult | null }) {
  if (!result) {
    return null;
  }
  return (
    <Alert severity="info">
      Suspended {result.suspended_ids.join(", ") || "none"}. Already suspended{" "}
      {result.already_suspended_ids.join(", ") || "none"}. Failed {result.failed_ids.join(", ") || "none"}.
    </Alert>
  );
}

export default function CustomerBansPage() {
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [bans, setBans] = useState<CustomerBan[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [preview, setPreview] = useState<CustomerBanMatchPreview | null>(null);
  const [suspendResult, setSuspendResult] = useState<CustomerBanSuspendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    customerBansApi
      .list({
        page,
        pageSize,
        active: activeOnly ? "yes" : "all",
      })
      .then((response) => {
        if (!cancelled) {
          setBans(response.bans);
          setTotalCount(response.total_count);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Customer bans could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, activeOnly, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const response = await customerBansApi.matchPreview({
        name_pattern: draft.name_pattern.trim() || undefined,
        email_pattern: draft.email_pattern.trim() || undefined,
        phone_pattern: draft.phone_pattern.trim() || undefined,
        address_pattern: draft.address_pattern.trim() || undefined,
      });
      setPreview(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Match preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await customerBansApi.create({
        name_pattern: draft.name_pattern.trim() || undefined,
        email_pattern: draft.email_pattern.trim() || undefined,
        phone_pattern: draft.phone_pattern.trim() || undefined,
        address_pattern: draft.address_pattern.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        is_active: draft.is_active,
      });
      setSuspendResult(response.suspend_result);
      setDraft(emptyDraft());
      setPreview(null);
      setReloadKey((current) => current + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Customer ban could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateBan(ban: CustomerBan) {
    setBusy(true);
    setError(null);
    try {
      const response = await customerBansApi.update(ban.id, { is_active: false });
      setSuspendResult(response.suspend_result);
      setReloadKey((current) => current + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Customer ban could not be deactivated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        Customers
      </Typography>
      <Tabs value="/customers/bans" variant="scrollable">
        {customersSections.map((section) => (
          <Tab key={section.to} label={section.label} value={section.to} component={RouterLink} to={section.to} />
        ))}
      </Tabs>
      <Typography variant="body2" color="text.secondary">
        Active bans hard-block login and checkout with the notice &quot;Customer is banned&quot;. Matching uses any provided field (OR). Soft-deactivate keeps history.
      </Typography>

      <Paper component="form" onSubmit={onCreate} sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Create ban</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Name pattern"
              size="small"
              fullWidth
              value={draft.name_pattern}
              onChange={(event) => setDraft((current) => ({ ...current, name_pattern: event.target.value }))}
            />
            <TextField
              label="Email pattern"
              size="small"
              fullWidth
              value={draft.email_pattern}
              onChange={(event) => setDraft((current) => ({ ...current, email_pattern: event.target.value }))}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Phone pattern"
              size="small"
              fullWidth
              value={draft.phone_pattern}
              onChange={(event) => setDraft((current) => ({ ...current, phone_pattern: event.target.value }))}
            />
            <TextField
              label="Address pattern"
              size="small"
              fullWidth
              value={draft.address_pattern}
              onChange={(event) => setDraft((current) => ({ ...current, address_pattern: event.target.value }))}
            />
          </Stack>
          <TextField
            label="Notes"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.is_active}
                onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}
              />
            }
            label="Active on save"
          />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled={busy} onClick={runPreview}>
              Match preview
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Save ban
            </Button>
          </Stack>
          {preview ? (
            <Alert severity={preview.match_count > 0 ? "warning" : "info"}>
              Preview found {preview.match_count} matching customer
              {preview.match_count === 1 ? "" : "s"}
              {preview.is_guest_only_rule ? " (guest-only rule until a match appears)." : "."}
              {preview.matches.length > 0
                ? ` IDs: ${preview.matches.map((match) => match.user_id).join(", ")}.`
                : ""}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <SuspendSummary result={suspendResult} />
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Loading customer bans...</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <FormControlLabel
          control={
            <Switch
              checked={activeOnly}
              onChange={(event) => {
                setPage(1);
                setActiveOnly(event.target.checked);
              }}
            />
          }
          label="Active bans only"
        />
      </Stack>

      {!loading && !error && bans.length === 0 ? <Alert severity="info">No customer bans match this filter.</Alert> : null}
      {!loading && !error && bans.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Patterns</TableCell>
                <TableCell>Linked customers</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {bans.map((ban) => (
                <TableRow key={ban.id}>
                  <TableCell>{ban.id}</TableCell>
                  <TableCell>
                    <Chip size="small" color={ban.is_active ? "error" : "default"} label={ban.is_active ? "Active" : "Inactive"} />
                  </TableCell>
                  <TableCell>{patternSummary(ban)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {ban.linked_customer_ids.length
                        ? ban.linked_customer_ids.map((customerId) => (
                            <Link key={customerId} component={RouterLink} to={`/customers/${customerId}`}>
                              {customerId}
                            </Link>
                          ))
                        : "None"}
                    </Stack>
                  </TableCell>
                  <TableCell>{ban.notes || "—"}</TableCell>
                  <TableCell>{ban.updated_at}</TableCell>
                  <TableCell>
                    {ban.is_active ? (
                      <Button size="small" disabled={busy} onClick={() => deactivateBan(ban)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center">
        <Button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
          Previous
        </Button>
        <Typography variant="body2">
          Page {page} of {totalPages}. {totalCount} bans.
        </Typography>
        <Button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
