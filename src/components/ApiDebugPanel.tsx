import { BugReport, Close } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  Popover,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
  Badge
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useState } from "react";
import {
  clearApiDebugEvents,
  getApiDebugState,
  setApiDebugEnabled,
  subscribeApiDebug
} from "../debug/apiDebugStore";

function ApiDebugPanel() {
  const [state, setState] = useState(getApiDebugState());
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | false>(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    return subscribeApiDebug(() => {
      setState(getApiDebugState());
    });
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'api-debug-popover' : undefined;

  const errorCount = state.events.filter(e => e.statusCode && e.statusCode >= 400).length;

  return (
    <>
      <IconButton color="inherit" onClick={handleClick} aria-describedby={id} title="API Debug Panel">
        <Badge badgeContent={errorCount} color="error">
          <BugReport />
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: isMobile ? 'calc(100vw - 32px)' : 600, p: 2, mt: 1 }
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            API Debug Panel
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption">Enabled</Typography>
            <Switch checked={state.enabled} onChange={(e) => setApiDebugEnabled(e.target.checked)} />
            <IconButton size="small" onClick={handleClose}>
              <Close />
            </IconButton>
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Latest {state.events.length} events
            </Typography>
            <Button size="small" onClick={clearApiDebugEvents}>
              Clear
            </Button>
          </Stack>
          <Box sx={{ maxHeight: 400, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 1, p: 1, userSelect: 'text' }}>
            {state.events.map((event) => (
              <Accordion
                key={event.id}
                expanded={expandedEventId === event.id}
                onChange={(_, expanded) => setExpandedEventId(expanded ? event.id : false)}
                disableGutters
                sx={{ boxShadow: "none", borderBottom: "1px solid #f0f0f0" }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                  <Box sx={{ width: "100%" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={event.method} />
                      <Typography variant="caption" sx={{ wordBreak: "break-all" }}>{event.url}</Typography>
                      {event.statusCode ? (
                        <Chip
                          size="small"
                          color={event.statusCode >= 400 ? "error" : "success"}
                          label={String(event.statusCode)}
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {event.timestamp} | {event.durationMs ?? 0} ms
                    </Typography>
                    {event.error ? (
                      <Typography variant="caption" color="error.main" display="block" sx={{ userSelect: 'text', wordBreak: 'break-all', mt: 0.5 }}>
                        {event.error}
                      </Typography>
                    ) : null}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography variant="caption" fontWeight={700}>Request Body</Typography>
                    <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "grey.100", borderRadius: 1, overflowX: "auto", fontSize: 12, whiteSpace: "pre-wrap" }}>
                      {event.requestBody ? formatDebugBody(event.requestBody) : "No request body"}
                    </Box>
                    <Typography variant="caption" fontWeight={700}>Response Body</Typography>
                    <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "grey.100", borderRadius: 1, overflowX: "auto", fontSize: 12, whiteSpace: "pre-wrap" }}>
                      {event.responseBody !== undefined ? formatDebugBody(event.responseBody) : "No response body captured"}
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Stack>
      </Popover>
    </>
  );
}

function formatDebugBody(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export default ApiDebugPanel;
