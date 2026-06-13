import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Switch,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  clearApiDebugEvents,
  getApiDebugState,
  setApiDebugEnabled,
  setApiDebugExpanded,
  subscribeApiDebug
} from "../debug/apiDebugStore";

function ApiDebugPanel() {
  const [state, setState] = useState(getApiDebugState());

  useEffect(() => {
    return subscribeApiDebug(() => {
      setState(getApiDebugState());
    });
  }, []);

  return (
    <Box sx={{ position: "fixed", right: 16, bottom: 16, width: state.expanded ? 600 : 320, zIndex: 2000 }}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>
              API Debug Panel
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption">Enabled</Typography>
              <Switch checked={state.enabled} onChange={(e) => setApiDebugEnabled(e.target.checked)} />
              <IconButton size="small" onClick={() => setApiDebugExpanded(!state.expanded)}>
                {state.expanded ? <ExpandMore /> : <ExpandLess />}
              </IconButton>
            </Stack>
          </Stack>

          {state.expanded ? (
            <Stack spacing={1} mt={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Latest {state.events.length} events
                </Typography>
                <Button size="small" onClick={clearApiDebugEvents}>
                  Clear
                </Button>
              </Stack>
              <Box sx={{ maxHeight: 300, overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: 1, p: 1 }}>
                {state.events.map((event) => (
                  <Box key={event.id} sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={event.method} />
                      <Typography variant="caption">{event.url}</Typography>
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
                      <Typography variant="caption" color="error.main" display="block">
                        {event.error}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </Stack>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}

export default ApiDebugPanel;
