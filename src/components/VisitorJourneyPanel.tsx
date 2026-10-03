import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  getCustomerJourney,
  getVisitorJourney,
  MalformedJourneyResponseError,
} from "../api/journeyApi";
import { ApiRequestError } from "../api/httpClient";
import { JourneyResponse } from "../types/journey";

type Props = {
  visitorId?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  defaultExpanded?: boolean;
};

export default function VisitorJourneyPanel({
  visitorId,
  customerId,
  customerName,
  defaultExpanded = false,
}: Props) {
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identityLabel = visitorId
    ? `visitor ${visitorId}`
    : customerId
      ? `customer #${customerId}`
      : null;

  useEffect(() => {
    let active = true;
    setJourney(null);
    setNotFound(false);
    setError(null);

    const request = visitorId
      ? getVisitorJourney(visitorId).catch((requestError: unknown) => {
        if (
          customerId
          && requestError instanceof ApiRequestError
          && requestError.status === 404
        ) {
          return getCustomerJourney(customerId);
        }
        throw requestError;
      })
      : customerId
        ? getCustomerJourney(customerId)
        : null;
    if (!request) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void request
      .then((response) => {
        if (active) setJourney(response);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(formatError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visitorId, customerId]);

  return (
    <Accordion variant="outlined" disableGutters defaultExpanded={defaultExpanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          gap={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          minWidth={0}
        >
          <Typography fontWeight={700}>Operator journey & intent</Typography>
          <Chip size="small" color="info" variant="outlined" label="Observation only" />
          {journey ? (
            <Chip size="small" label={formatLabel(journey.profile.stage)} />
          ) : null}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {!identityLabel ? (
          <Alert severity="info">No visitor or WooCommerce customer journey reference is available.</Alert>
        ) : loading ? (
          <Stack direction="row" spacing={1} alignItems="center" py={1}>
            <CircularProgress size={22} />
            <Typography variant="body2">Loading journey for {identityLabel}…</Typography>
          </Stack>
        ) : notFound ? (
          <Alert severity="info">No journey has been recorded for this {identityLabel}.</Alert>
        ) : error ? (
          <Alert severity="warning">{error}</Alert>
        ) : journey ? (
          <JourneyContent
            journey={journey}
            referencedCustomerId={customerId}
            customerName={customerName}
          />
        ) : (
          <Alert severity="info">No journey data is available.</Alert>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function JourneyContent({
  journey,
  referencedCustomerId,
  customerName,
}: {
  journey: JourneyResponse;
  referencedCustomerId?: number | null;
  customerName?: string | null;
}) {
  const { profile } = journey;
  const linkedCustomerId = profile.customer_id ?? referencedCustomerId;
  const events = [...journey.events].sort(
    (left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at),
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Read-only operational context. No offer or automated action is generated.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <JourneyValue label="Stage" value={formatLabel(profile.stage)} />
        <JourneyValue label="Score" value={formatNumber(profile.score)} />
        <JourneyValue label="Confidence" value={formatLabel(profile.confidence)} />
        <JourneyValue
          label="Linked customer"
          value={linkedCustomerId
            ? customerName || `WooCommerce #${linkedCustomerId}`
            : "Not linked"}
        />
        <JourneyValue
          label="Last seen"
          value={`${formatPageLocation(
            profile.last_page_title,
            profile.last_page_path,
            profile.last_context,
          )} · ${formatDate(profile.last_seen_at)}`}
        />
        <JourneyValue
          label="Last object"
          value={profile.last_object_id === null || profile.last_object_id === undefined
            ? "Not recorded"
            : String(profile.last_object_id)}
        />
        <JourneyValue label="First observed" value={formatDate(profile.first_seen_at)} />
        <JourneyValue label="Expires" value={formatDate(profile.expires_at)} />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">Explainable reasons</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" mt={0.5}>
          {profile.reason_codes.length ? profile.reason_codes.map((reason) => (
            <Chip key={reason} size="small" variant="outlined" label={formatLabel(reason)} />
          )) : (
            <Typography variant="body2" color="text.secondary">No reasons recorded.</Typography>
          )}
        </Stack>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">Event counts</Typography>
        <Stack direction="row" gap={0.75} flexWrap="wrap" mt={0.5}>
          {Object.entries(profile.event_counts).length
            ? Object.entries(profile.event_counts).map(([eventType, count]) => (
                <Chip key={eventType} size="small" label={`${formatLabel(eventType)}: ${count}`} />
              ))
            : <Typography variant="body2" color="text.secondary">No event counts recorded.</Typography>}
        </Stack>
      </Box>

      <Divider />
      <Box>
        <Typography variant="subtitle2">Journey timeline</Typography>
        <Stack
          spacing={1}
          mt={1}
          sx={{ maxHeight: 280, overflowY: "auto", pr: 1 }}
          aria-label="Journey timeline"
        >
          {events.length ? events.map((event) => (
            <Box key={event.event_id} sx={{ borderLeft: 2, borderColor: "divider", pl: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {formatLabel(event.event_type)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(event.occurred_at)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatPageLocation(
                  event.context.page_title,
                  event.context.page_path,
                  event.context.type,
                )}
                {event.context.object_id !== null ? ` #${event.context.object_id}` : ""}
                {` · ${formatLabel(event.intent.stage)} · score ${formatNumber(event.intent.score)}`}
              </Typography>
              {event.intent.reason_codes.length ? (
                <Typography variant="caption" display="block">
                  {event.intent.reason_codes.map(formatLabel).join(" · ")}
                </Typography>
              ) : null}
            </Box>
          )) : (
            <Typography variant="body2" color="text.secondary">No journey events recorded.</Typography>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

function JourneyValue({ label, value }: { label: string; value: string }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

function formatError(error: unknown): string {
  if (error instanceof MalformedJourneyResponseError) {
    return "Journey data could not be displayed because the API response was incomplete or malformed.";
  }
  return error instanceof Error ? error.message : String(error);
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}

function formatPageLocation(
  title?: string | null,
  path?: string | null,
  context?: string | null,
): string {
  if (title && path) return `${title} (${path})`;
  return title || path || (context ? formatLabel(context) : "Unknown location");
}
