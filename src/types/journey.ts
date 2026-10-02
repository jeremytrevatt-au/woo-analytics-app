export type JourneyContext = {
  type: string;
  object_id: string | number | null;
};

export type JourneyIntent = {
  stage: string;
  score: number;
  confidence: "low" | "medium" | "high";
  reason_codes: string[];
};

export type JourneyProfile = JourneyIntent & {
  visitor_id: string;
  cart_id?: string | null;
  customer_id?: number | null;
  customer_analytics_key?: string | null;
  event_counts: Record<string, number>;
  last_context: string;
  last_object_id?: string | number | null;
  first_seen_at: string;
  last_seen_at: string;
  expires_at: string;
};

export type JourneyEventSummary = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  context: JourneyContext;
  intent: JourneyIntent;
};

export type JourneyResponse = {
  profile: JourneyProfile;
  events: JourneyEventSummary[];
};
