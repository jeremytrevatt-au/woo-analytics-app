import { fetchJson } from "./httpClient";

export async function triggerDataSync(): Promise<{ status: string; message: string; operation: string }> {
  return fetchJson<{ status: string; message: string; operation: string }>("/api/v1/admin/sync", {
    method: "POST",
  });
}
