import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  CrmCustomerEmailHistoryResponse,
  listCrmCustomerEmailHistory,
} from "../api/crmApi";

type Props = {
  customerEmail?: string;
};

function CustomerEmailHistorySection({ customerEmail }: Props) {
  const [history, setHistory] = useState<CrmCustomerEmailHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!customerEmail) {
      setHistory(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setHistory(await listCrmCustomerEmailHistory(customerEmail));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [customerEmail]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Email History
          </Typography>
          <Button size="small" onClick={() => void loadHistory()} disabled={!customerEmail || isLoading}>
            Refresh
          </Button>
        </Stack>

        {!customerEmail ? (
          <Alert severity="info">Email history requires a customer email address.</Alert>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {history?.sync_state === "not_configured" ? (
          <Alert severity="info">The Gmail connector is not configured for this environment.</Alert>
        ) : null}
        {history?.sync_state === "unavailable" ? (
          <Alert severity="warning">The Gmail connector has not completed its initial synchronization.</Alert>
        ) : null}
        {history?.sync_state === "stale" ? (
          <Alert severity="warning">
            Gmail synchronization is stale. The displayed history may be incomplete.
          </Alert>
        ) : null}
        {isLoading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading email history...
            </Typography>
          </Stack>
        ) : null}

        {history?.sync_state === "ok" && history.messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No matching messages were found in the connected mailbox.
          </Typography>
        ) : null}

        {(history?.messages.length ?? 0) > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Direction</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Subject and preview</TableCell>
                <TableCell>Original</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history?.messages.map((message) => (
                <TableRow key={message.message_id}>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={message.direction === "inbound" ? "Inbound" : "Outbound"}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatEmailDate(message.sent_at)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {message.subject || "(No subject)"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {message.snippet}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {message.gmail_url ? (
                      <Link
                        href={message.gmail_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                      >
                        Open in Gmail
                      </Link>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Link unavailable
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {history?.last_synced_at ? (
          <Typography variant="caption" color="text.secondary">
            Last synchronized {formatEmailDate(history.last_synced_at)}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function formatEmailDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-AU");
}

export default CustomerEmailHistorySection;
