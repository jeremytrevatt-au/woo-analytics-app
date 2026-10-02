import { JourneyEventSummary, JourneyProfile, JourneyResponse } from "../types/journey";
import { fetchJson } from "./httpClient";

export class MalformedJourneyResponseError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Journey response is malformed: ${issues.join("; ")}`);
    this.name = "MalformedJourneyResponseError";
  }
}

export async function getVisitorJourney(visitorId: string): Promise<JourneyResponse> {
  const payload = await fetchJson<unknown>(
    `/api/v1/journeys/visitor/${encodeURIComponent(visitorId)}`,
  );
  return parseJourneyResponse(payload);
}

export async function getCustomerJourney(customerId: number): Promise<JourneyResponse> {
  const payload = await fetchJson<unknown>(
    `/api/v1/journeys/customer/${encodeURIComponent(String(customerId))}`,
  );
  return parseJourneyResponse(payload);
}

export function parseJourneyResponse(payload: unknown): JourneyResponse {
  const issues: string[] = [];
  if (!isRecord(payload)) {
    throw new MalformedJourneyResponseError(["response must be an object"]);
  }

  const profile = parseProfile(payload.profile, issues);
  const events = Array.isArray(payload.events)
    ? payload.events.flatMap((event, index) => {
        const parsed = parseEvent(event, index, issues);
        return parsed ? [parsed] : [];
      })
    : (issues.push("events must be an array"), []);

  if (!profile || issues.length) {
    throw new MalformedJourneyResponseError(issues);
  }
  return { profile, events };
}

function parseProfile(value: unknown, issues: string[]): JourneyProfile | null {
  if (!isRecord(value)) {
    issues.push("profile must be an object");
    return null;
  }

  const requiredStrings = [
    "visitor_id",
    "stage",
    "last_context",
    "first_seen_at",
    "last_seen_at",
    "expires_at",
  ] as const;
  requiredStrings.forEach((field) => {
    if (typeof value[field] !== "string") issues.push(`profile.${field} must be a string`);
  });
  if (!isFiniteNumber(value.score)) issues.push("profile.score must be a finite number");
  if (!isConfidence(value.confidence)) {
    issues.push("profile.confidence must be low, medium, or high");
  }
  if (!isStringArray(value.reason_codes)) issues.push("profile.reason_codes must be a string array");
  if (!isCountRecord(value.event_counts)) issues.push("profile.event_counts must contain numeric counts");
  if (!isOptionalString(value.cart_id)) issues.push("profile.cart_id must be a string or null");
  if (!isOptionalNumber(value.customer_id)) issues.push("profile.customer_id must be a number or null");
  if (!isOptionalString(value.customer_analytics_key)) {
    issues.push("profile.customer_analytics_key must be a string or null");
  }
  if (!isOptionalObjectId(value.last_object_id)) {
    issues.push("profile.last_object_id must be a string, number, or null");
  }

  if (issues.length) return null;
  return value as JourneyProfile;
}

function parseEvent(
  value: unknown,
  index: number,
  issues: string[],
): JourneyEventSummary | null {
  const prefix = `events[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${prefix} must be an object`);
    return null;
  }
  if (typeof value.event_id !== "string") issues.push(`${prefix}.event_id must be a string`);
  if (typeof value.event_type !== "string") issues.push(`${prefix}.event_type must be a string`);
  if (typeof value.occurred_at !== "string") issues.push(`${prefix}.occurred_at must be a string`);

  const context = value.context;
  if (
    !isRecord(context)
    || typeof context.type !== "string"
    || !("object_id" in context)
    || context.object_id === undefined
    || !isOptionalObjectId(context.object_id)
  ) {
    issues.push(`${prefix}.context is malformed`);
  }
  const intent = value.intent;
  if (
    !isRecord(intent)
    || typeof intent.stage !== "string"
    || !isFiniteNumber(intent.score)
    || !isConfidence(intent.confidence)
    || !isStringArray(intent.reason_codes)
  ) {
    issues.push(`${prefix}.intent is malformed`);
  }

  return issues.some((issue) => issue.startsWith(prefix))
    ? null
    : value as JourneyEventSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isConfidence(value: unknown): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

function isCountRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || isFiniteNumber(value);
}

function isOptionalObjectId(value: unknown): value is string | number | null | undefined {
  return isOptionalString(value) || isOptionalNumber(value);
}
