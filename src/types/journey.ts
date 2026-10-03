export type JourneyContext = {
  type: string;
  object_id: string | number | null;
  page_path?: string | null;
  page_title?: string | null;
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
  last_page_path?: string | null;
  last_page_title?: string | null;
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

export type JourneyStage =
  | "unengaged"
  | "exploring"
  | "considering"
  | "cart_intent"
  | "checkout_intent"
  | "converted";

export type JourneyLinkage = "all" | "customer" | "cart" | "unlinked";

export type JourneySort = "score_desc" | "recent_desc";

export type JourneyListResponse = {
  items: JourneyProfile[];
  page: number;
  per_page: number;
  total: number;
};
