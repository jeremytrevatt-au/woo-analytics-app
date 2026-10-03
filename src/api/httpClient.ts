import { pushApiDebugEvent } from "../debug/apiDebugStore";
import { ApiDebugEvent } from "../types/analytics";

const apiBaseUrl = (import.meta.env.VITE_ANALYTICS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export class ApiRequestError extends Error {
  status: number;
  url: string;
  responseBody: unknown;

  constructor(message: string, status: number, url: string, responseBody: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.url = url;
    this.responseBody = responseBody;
  }
}

export function requireApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error("VITE_ANALYTICS_API_BASE_URL is not configured.");
  }
  return apiBaseUrl;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = requireApiBaseUrl();
  const url = `${baseUrl}${path}`;
  
  const headers = new Headers(init?.headers);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const finalInit = {
    ...init,
    headers,
    cache: "no-store" as RequestCache,
    credentials: init?.credentials ?? "include",
  };
  const method = finalInit.method ?? "GET";
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const isChatRequest = path.startsWith("/api/v1/chat");
  const isEmailHistoryRequest = path.startsWith("/api/v1/crm/customer-email-history");
  const isSensitiveRequest = isChatRequest || isEmailHistoryRequest;
  const debugUrl = isEmailHistoryRequest ? redactEmailHistoryUrl(url) : url;
  const debugRequestBody = isSensitiveRequest ? redactSensitivePayload(init?.body) : init?.body ? String(init.body) : undefined;

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
      url: debugUrl,
      requestBody: debugRequestBody,
      statusCode: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      responseBody: isSensitiveRequest ? redactSensitivePayload(parsedBody) : parsedBody
    };
    pushApiDebugEvent(event);
    mirrorDebugEvent(baseUrl, path, event);

    if (!response.ok) {
      throw new ApiRequestError(
        buildErrorMessage(response.status, debugUrl, parsedBody, textBody),
        response.status,
        debugUrl,
        isSensitiveRequest ? redactSensitivePayload(parsedBody) : parsedBody,
      );
    }
    return parsedBody as T;
  } catch (error) {
    const event: ApiDebugEvent = {
      id: crypto.randomUUID(),
      timestamp,
      method,
      url: debugUrl,
      requestBody: debugRequestBody,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error)
    };
    pushApiDebugEvent(event);
    mirrorDebugEvent(baseUrl, path, event);
    throw error;
  }
}

function buildErrorMessage(status: number, url: string, parsedBody: unknown, textBody: string): string {
  if (parsedBody && typeof parsedBody === "object" && "detail" in parsedBody) {
    const detail = (parsedBody as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return `API request failed (${status}) ${url}: ${detail}`;
    }
    const shippitMessage = extractShippitNestedError(detail);
    if (shippitMessage) {
      return `API request failed (${status}) ${url}: ${shippitMessage}`;
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = String((detail as { message?: unknown }).message ?? textBody);
      return `API request failed (${status}) ${url}: ${message}`;
    }
  }

  return `API request failed (${status}) ${url}: ${textBody}`;
}

function extractShippitNestedError(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail) || !("result" in detail)) {
    return null;
  }

  const result = (detail as { result?: unknown }).result;
  if (!result || typeof result !== "object" || Array.isArray(result) || !("body" in result)) {
    return null;
  }

  const body = (result as { body?: unknown }).body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !("errors" in body)) {
    return null;
  }

  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || !errors[0] || typeof errors[0] !== "object" || Array.isArray(errors[0])) {
    return null;
  }

  const firstError = errors[0] as { message?: unknown; code?: unknown };
  const message = typeof firstError.message === "string" ? firstError.message : "";
  const code = typeof firstError.code === "string" ? firstError.code : "";
  if (!message) {
    return null;
  }

  return code ? `Shippit error ${code}: ${message}` : `Shippit error: ${message}`;
}

function mirrorDebugEvent(baseUrl: string, path: string, event: ApiDebugEvent): void {
  const mirroredEvent = path.startsWith("/api/v1/journeys")
    ? redactJourneyDebugEvent(event)
    : path === "/api/v1/coupons"
      ? redactCouponDebugEvent(event)
    : event;
  fetch(`${baseUrl}/api/v1/diagnostics/frontend-event`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mirroredEvent)
  }).catch(() => {
    // diagnostics mirror should not block the primary call
  });
}

export function redactCouponDebugEvent(event: ApiDebugEvent): ApiDebugEvent {
  return {
    ...event,
    requestBody: redactCouponPayload(event.requestBody),
    responseBody: redactCouponPayload(event.responseBody),
    error: event.error ? "[redacted coupon error]" : event.error,
  };
}

function redactCouponPayload(value: unknown): unknown {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return "[redacted coupon payload]";
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(redactCouponPayload);
  }
  if (parsed && typeof parsed === "object") {
    return Object.fromEntries(
      Object.entries(parsed).map(([key, child]) => {
        const normalized = key.toLowerCase();
        if (
          normalized === "code"
          || normalized === "custom_message"
          || normalized === "delivery_message"
          || normalized === "visitor_id"
          || normalized === "cart_id"
          || normalized === "customer_id"
          || normalized === "conversation_id"
          || normalized.includes("email")
        ) {
          return [key, "[redacted]"];
        }
        return [key, redactCouponPayload(child)];
      }),
    );
  }
  return parsed;
}

export function redactJourneyDebugEvent(event: ApiDebugEvent): ApiDebugEvent {
  return {
    ...event,
    url: redactJourneyText(event.url),
    requestBody: redactJourneyPayload(event.requestBody),
    responseBody: redactJourneyPayload(event.responseBody),
    error: event.error ? redactJourneyText(event.error) : event.error,
  };
}

function redactJourneyPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactJourneyPayload);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const normalized = key.toLowerCase();
        if (
          normalized === "visitor_id"
          || normalized === "cart_id"
          || normalized === "customer_id"
          || normalized === "customer_analytics_key"
        ) {
          return [key, "[redacted]"];
        }
        return [key, redactJourneyPayload(child)];
      }),
    );
  }
  return value;
}

function redactJourneyText(value: string): string {
  return value
    .replace(/(\/journeys\/visitor\/)[^/?\s:]+/gi, "$1[redacted]")
    .replace(/(\/journeys\/customer\/)\d+/gi, "$1[redacted]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted]",
    )
    .replace(/\b[0-9a-f]{64}\b/gi, "[redacted]");
}

function redactSensitivePayload(value: unknown): unknown {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return "[redacted chat payload]";
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(redactSensitivePayload);
  }
  if (parsed && typeof parsed === "object") {
    return Object.fromEntries(
      Object.entries(parsed).map(([key, child]) => {
        const normalized = key.toLowerCase();
        if (
          normalized === "body"
          || normalized === "content"
          || normalized === "subject"
          || normalized === "snippet"
          || normalized.includes("email")
          || normalized.includes("name")
          || normalized.includes("order")
        ) {
          return [key, "[redacted]"];
        }
        return [key, redactSensitivePayload(child)];
      }),
    );
  }
  return parsed;
}

function redactEmailHistoryUrl(url: string): string {
  return url.replace(
    /([?&]customer_email=)[^&]*/i,
    "$1[redacted]",
  );
}
