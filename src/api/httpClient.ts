import { pushApiDebugEvent } from "../debug/apiDebugStore";
import { ApiDebugEvent } from "../types/analytics";

const apiBaseUrl = (import.meta.env.VITE_ANALYTICS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export function requireApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error("VITE_ANALYTICS_API_BASE_URL is not configured.");
  }
  return apiBaseUrl;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const finalInit = { ...init, cache: "no-store" as RequestCache };
  const method = finalInit.method ?? "GET";
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(url, finalInit);
    const textBody = await response.text();
    let parsedBody: unknown = textBody;
    try {
      parsedBody = textBody ? JSON.parse(textBody) : null;
    } catch {
      // keep raw string payload
    }

    const event: ApiDebugEvent = {
      id: crypto.randomUUID(),
      timestamp,
      method,
      url,
      requestBody: init?.body ? String(init.body) : undefined,
      statusCode: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      responseBody: parsedBody
    };
    pushApiDebugEvent(event);
    mirrorDebugEvent(baseUrl, event);

    if (!response.ok) {
      throw new Error(`API request failed (${response.status}) ${url}: ${textBody}`);
    }
    return parsedBody as T;
  } catch (error) {
    const event: ApiDebugEvent = {
      id: crypto.randomUUID(),
      timestamp,
      method,
      url,
      requestBody: init?.body ? String(init.body) : undefined,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error)
    };
    pushApiDebugEvent(event);
    mirrorDebugEvent(baseUrl, event);
    throw error;
  }
}

function mirrorDebugEvent(baseUrl: string, event: ApiDebugEvent): void {
  fetch(`${baseUrl}/api/v1/diagnostics/frontend-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  }).catch(() => {
    // diagnostics mirror should not block the primary call
  });
}
