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
  updateStationPrinters,
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

function StationPrinterField({
  label,
  value,
  printers,
  onChange,
}: {
  label: string;
  value: string;
  printers: PrintPrinterOption[];
  onChange: (value: string) => void;
}) {
  if (printers.length === 0) {
    return (
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        helperText="No printers have been reported for this station. Type the Windows printer name."
        sx={{ minWidth: 320, flex: 1 }}
      />
    );
  }

  const selectedValue = printers.some(printer => printer.name === value) ? value : "";
  return (
    <FormControl sx={{ minWidth: 320, flex: 1 }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={selectedValue} onChange={(event) => onChange(event.target.value)}>
        <MenuItem value="" disabled>
          Select a reported printer
        </MenuItem>
        {printers.map(printer => (
          <MenuItem key={printer.name} value={printer.name}>
            {printer.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function PrintJobsPage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<PrintPrinterOption[]>([]);
  const [printerReport, setPrinterReport] = useState<PrintPrintersResponse | null>(null);
  const [stationId, setStationId] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [a4PrinterName, setA4PrinterName] = useState("");
  const [labelPrinterName, setLabelPrinterName] = useState("");
  const [savingPrinters, setSavingPrinters] = useState(false);
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

  const applyPrinterReport = (response: PrintPrintersResponse) => {
    setPrinterReport(response);
    setPrinters(response.printers);
    setStationId(response.station_id || response.default_station_id);
    setA4PrinterName(response.default_printer_name || "");
    setLabelPrinterName(response.shippit_label_printer_name || "");
    setPrinterName(current => {
      if (current && response.printers.some(printer => printer.name === current)) {
        return current;
      }
      return response.default_printer_name || "";
    });
  };

  const loadPrinters = async (requestedStationId?: string) => {
    try {
      const response = await listPrintPrinters(requestedStationId);
      applyPrinterReport(response);
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

  const handleSaveStationPrinters = async () => {
    const trimmedStationId = stationId.trim();
    const trimmedA4Printer = a4PrinterName.trim();
    const trimmedLabelPrinter = labelPrinterName.trim();
    if (!trimmedStationId || !trimmedA4Printer || !trimmedLabelPrinter) {
      setMessage({ type: "error", text: "Station ID, A4 printer, and Shippit label printer are required." });
      return;
    }

    setSavingPrinters(true);
    setMessage(null);
    try {
      const saved = await updateStationPrinters({
        station_id: trimmedStationId,
        default_printer_name: trimmedA4Printer,
        shippit_label_printer_name: trimmedLabelPrinter,
      });
      applyPrinterReport(saved);
      setMessage({
        type: "success",
        text: `Saved printers for ${trimmedStationId}. Shippit labels will use ${trimmedLabelPrinter}.`,
      });
    } catch (error: unknown) {
      setMessage({ type: "error", text: getErrorMessage(error, "Failed to save station printers.") });
    } finally {
      setSavingPrinters(false);
    }
  };

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
          Station printers
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set the A4 printer and the dedicated Shippit label printer stored for a station. Return and packing label prints use the Shippit label printer.
        </Typography>
        <Stack spacing={2}>
          {printerReport?.is_reported ? (
            <Alert severity="info">
              Station {printerReport.station_id || stationId} last reported
              {printerReport.last_seen_at ? ` at ${printerReport.last_seen_at}` : ""}.
              {" "}A4 printer: {printerReport.default_printer_name || "not set"}.
              {" "}Shippit label printer: {printerReport.shippit_label_printer_name || "not set"}.
            </Alert>
          ) : (
            <Alert severity="warning">
              This station has not reported its installed printers. Type the Windows printer names to save them.
            </Alert>
          )}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Station ID"
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            <Button variant="outlined" onClick={() => void loadPrinters(stationId)}>
              Load station
            </Button>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <StationPrinterField
              label="A4 printer"
              value={a4PrinterName}
              printers={printers}
              onChange={setA4PrinterName}
            />
            <StationPrinterField
              label="Shippit label printer"
              value={labelPrinterName}
              printers={printers}
              onChange={setLabelPrinterName}
            />
          </Stack>
          <Button
            variant="contained"
            onClick={() => void handleSaveStationPrinters()}
            disabled={savingPrinters || !stationId.trim() || !a4PrinterName.trim() || !labelPrinterName.trim()}
          >
            Save station printers
          </Button>
        </Stack>
      </Paper>

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
              helperText="Same station as the printer settings above."
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
            <Button variant="outlined" onClick={() => void loadPrinters(stationId)}>
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
