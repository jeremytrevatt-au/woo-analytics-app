import { useEffect, useState } from "react";
import { Alert, Button, Chip, Collapse, FormControlLabel, IconButton, Link, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tab, Tabs, TextField, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Link as RouterLink } from "react-router-dom";
import { RegisteredAccount, registeredAccountFlagLabels, registeredAccountsApi, RegisteredAccountList } from "../api/registeredAccountsApi";
import { wordpressAdminUrl } from "../config/wordpress";
import { securitySections } from "./securitySections";

const pageSize = 50;

function formatRegisteredAt(value: string): string {
  const parsed = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function presence(missing: boolean): string {
  return missing ? "No" : "Yes";
}

function addressLines(label: string, address: RegisteredAccount["billing_address"], missing: boolean) {
  if (missing) {
    return `${label}: no address`;
  }
  return `${label}: ${[address.address_1, address.city, address.postcode, address.country].filter(Boolean).join(", ")}`;
}

function AccountRow({ account }: { account: RegisteredAccount }) {
  const [open, setOpen] = useState(false);
  const flags = registeredAccountFlagLabels.filter(([key]) => account[key] === true);
  const wordpressUserUrl = wordpressAdminUrl(`user-edit.php?user_id=${account.user_id}`);

  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton aria-label={`Details for account ${account.user_id}`} size="small" onClick={() => setOpen((current) => !current)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{formatRegisteredAt(account.registered_at)}</TableCell>
        <TableCell>{account.email || "Missing"}</TableCell>
        <TableCell>{account.first_name}</TableCell>
        <TableCell>{account.last_name}</TableCell>
        <TableCell>{presence(account.is_missing_billing_address)}</TableCell>
        <TableCell>{presence(account.is_missing_shipping_address)}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {flags.length ? flags.map(([, label]) => <Chip key={label} size="small" label={label} />) : <Chip size="small" label="None" variant="outlined" />}
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Stack spacing={1} sx={{ py: 1.5 }}>
              <Typography variant="body2">Username: {account.user_login}</Typography>
              <Typography variant="body2">Display name: {account.display_name || "Missing"}</Typography>
              <Typography variant="body2">{addressLines("Billing", account.billing_address, account.is_missing_billing_address)}</Typography>
              <Typography variant="body2">{addressLines("Shipping", account.shipping_address, account.is_missing_shipping_address)}</Typography>
              <Stack direction="row" spacing={2}>
                <Link component={RouterLink} to={`/customers/${account.user_id}`}>CRM profile</Link>
                {wordpressUserUrl ? <Link href={wordpressUserUrl} target="_blank" rel="noopener noreferrer">WordPress user</Link> : null}
              </Stack>
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function SecurityRegisteredAccountsPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RegisteredAccountList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    registeredAccountsApi.list({
      page,
      pageSize,
      q: query,
      quality: flaggedOnly ? "flagged" : "all",
    }).then((response) => {
      if (!cancelled) {
        setResult(response);
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Registered accounts could not be loaded.");
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, query, flaggedOnly]);

  const totalCount = result?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>Security</Typography>
      <Tabs value="/security/registered-accounts" variant="scrollable">
        {securitySections.map((section) => (
          <Tab key={section.to} label={section.label} value={section.to} component={RouterLink} to={section.to} />
        ))}
      </Tabs>
      <Typography variant="body2" color="text.secondary">
        Customer accounts that have registered and have no shop order. Checkout drafts and trashed orders are ignored. Cancelled and failed orders still count as an order.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <TextField
          label="Search email or name"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setPage(1);
              setQuery(draftQuery.trim());
            }
          }}
          size="small"
        />
        <Button
          variant="outlined"
          onClick={() => {
            setPage(1);
            setQuery(draftQuery.trim());
          }}
        >
          Search
        </Button>
        <FormControlLabel
          control={<Switch checked={flaggedOnly} onChange={(event) => {
            setPage(1);
            setFlaggedOnly(event.target.checked);
          }} />}
          label="Flagged accounts only"
        />
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <Alert severity="info">Loading registered accounts...</Alert> : null}
      {!loading && !error && result && result.accounts.length === 0 ? (
        <Alert severity="info">No registered accounts match this search.</Alert>
      ) : null}
      {!loading && !error && result && result.accounts.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Registered</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>First name</TableCell>
                <TableCell>Last name</TableCell>
                <TableCell>Billing address</TableCell>
                <TableCell>Shipping address</TableCell>
                <TableCell>Flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.accounts.map((account) => <AccountRow key={account.user_id} account={account} />)}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
        <Typography variant="body2">Page {page} of {totalPages}. {totalCount} accounts.</Typography>
        <Button disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </Stack>
    </Stack>
  );
}
