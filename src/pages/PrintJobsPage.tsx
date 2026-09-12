import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  createPrintJob,
  listPrintJobs,
  listPrintPrinters,
} from "../api/printJobsApi";
import type { PrintJob, PrintPrinterOption, PrintPrintersResponse } from "../api/printJobsApi";

const SOURCE_OPTIONS = [
  { value: "pdf_url", label: "PDF or Shippit Label URL" },
  { value: "google_drive_url", label: "Google Doc/Sheet/Slide URL" },
];

function inferDocumentName(documentUrl: string, sourceType: string): string {
  if (sourceType === "google_drive_url") return "google-drive-document.pdf";
  try {
    const url = new URL(documentUrl);
    const segment = url.pathname.split("/").filter(Boolean).pop() || "print-job.pdf";
    return segment.toLowerCase().endsWith(".pdf") ? segment : `${segment}.pdf`;
  } catch {
    return "print-job.pdf";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function PrintJobsPage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<PrintPrinterOption[]>([]);
  const [printerReport, setPrinterReport] = useState<PrintPrintersResponse | null>(null);
  const [stationId, setStationId] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [sourceType, setSourceType] = useState("google_drive_url");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedPrinter = useMemo(
    () => printers.find(printer => printer.name === printerName),
    [printerName, printers]
  );

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await listPrintJobs({ status: statusFilter });
      setJobs(response);
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Failed to load print jobs.") });
    } finally {
      setLoading(false);
    }
  };

  const loadPrinters = async () => {
    try {
      const response = await listPrintPrinters();
      setPrinterReport(response);
      setPrinters(response.printers);
      setStationId(response.default_station_id);
      setPrinterName(response.default_printer_name);
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Failed to load printer configuration.") });
    }
  };

  useEffect(() => {
    void loadPrinters();
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [statusFilter]);

  const handleQueue = async () => {
    const trimmedUrl = documentUrl.trim();
    if (!trimmedUrl) {
      setMessage({ type: "error", text: "Document URL is required." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const queued = await createPrintJob({
        document_url: trimmedUrl,
        document_name: documentName.trim() || inferDocumentName(trimmedUrl, sourceType),
        station_id: stationId.trim(),
        printer_name: printerName.trim(),
        source_type: sourceType,
        payload: {
          queued_from: "print_jobs_page",
        },
      });
      setDocumentUrl("");
      setDocumentName("");
      setMessage({ type: "success", text: `Print job #${queued.id} queued for ${queued.printer_name}.` });
      await loadJobs();
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Failed to queue print job.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Print Jobs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Queue PDF labels or Google Drive documents for the local print agent and monitor print status.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Queue Test Print
        </Typography>
        <Stack spacing={2}>
          {printerReport?.is_reported ? (
            <Alert severity="info">
              Printers last reported by station {printerReport.station_id || stationId}
              {printerReport.last_seen_at ? ` at ${printerReport.last_seen_at}` : ""}.
            </Alert>
          ) : (
            <Alert severity="warning">
              No live printer report has been received for this station yet. Start the print agent on the printer workstation to populate this list.
            </Alert>
          )}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel>Source Type</InputLabel>
              <Select label="Source Type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                {SOURCE_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Station ID"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            <FormControl sx={{ minWidth: 260 }}>
              <InputLabel>Printer</InputLabel>
              <Select label="Printer" value={printerName} onChange={(event) => setPrinterName(event.target.value)}>
                {printers.map(printer => (
                  <MenuItem key={printer.name} value={printer.name}>
                    {printer.name}{printer.is_default ? " (default)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={loadPrinters}>
              Refresh Printers
            </Button>
          </Stack>
          <TextField
            label="Document URL"
            value={documentUrl}
            onChange={(event) => setDocumentUrl(event.target.value)}
            helperText="Use a Shippit label PDF URL or a Google Doc/Sheet/Slide URL that the service can export."
            fullWidth
          />
          <TextField
            label="Document Name"
            value={documentName}
            onChange={(event) => setDocumentName(event.target.value)}
            helperText="Optional. A .pdf suffix will be added by the backend if needed."
            fullWidth
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={handleQueue} disabled={saving || !stationId || !printerName}>
              Queue Print Job
            </Button>
            {selectedPrinter ? (
              <Typography variant="caption" color="text.secondary">
                Selected printer: {selectedPrinter.name}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Recent Jobs</Typography>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="queued">Queued</MenuItem>
                <MenuItem value="leased">Leased</MenuItem>
                <MenuItem value="printed">Printed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={loadJobs} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Station</TableCell>
              <TableCell>Printer</TableCell>
              <TableCell>Attempts</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map(job => (
              <TableRow key={job.id}>
                <TableCell>{job.id}</TableCell>
                <TableCell>{job.status}</TableCell>
                <TableCell>{job.document_name}</TableCell>
                <TableCell>{job.station_id}</TableCell>
                <TableCell>{job.printer_name}</TableCell>
                <TableCell>{job.attempts}</TableCell>
                <TableCell>{job.last_message || ""}</TableCell>
                <TableCell>{job.updated_at}</TableCell>
              </TableRow>
            ))}
            {!loading && jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">
                    No print jobs found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">
                    Loading print jobs...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default PrintJobsPage;
