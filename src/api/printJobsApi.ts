import { fetchJson } from "./httpClient";

export type PrintJob = {
  id: number;
  status: string;
  station_id: string;
  printer_name: string;
  document_name: string;
  document_url: string;
  source_type: string;
  attempts: number;
  last_message?: string | null;
  locked_at?: string | null;
  printed_at?: string | null;
  created_at: string;
  updated_at: string;
  payload?: Record<string, unknown>;
};

export type PrintPrinterOption = {
  name: string;
  is_default: boolean;
};

export type PrintPrintersResponse = {
  default_station_id: string;
  default_printer_name: string;
  printers: PrintPrinterOption[];
};

export type PrintJobCreatePayload = {
  document_url: string;
  document_name: string;
  station_id?: string;
  printer_name?: string;
  source_type?: string;
  payload?: Record<string, unknown>;
};

export async function listPrintJobs(params: { status?: string; stationId?: string } = {}): Promise<PrintJob[]> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.append("status", params.status);
  if (params.stationId && params.stationId !== "all") query.append("station_id", params.stationId);
  const qs = query.toString();
  return fetchJson<PrintJob[]>(`/api/v1/print-jobs${qs ? `?${qs}` : ""}`);
}

export async function createPrintJob(payload: PrintJobCreatePayload): Promise<PrintJob> {
  return fetchJson<PrintJob>("/api/v1/print-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listPrintPrinters(): Promise<PrintPrintersResponse> {
  return fetchJson<PrintPrintersResponse>("/api/v1/print-jobs/printers");
}
