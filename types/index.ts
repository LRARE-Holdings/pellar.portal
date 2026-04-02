// Database enums

export type LeadStage =
  | "identified"
  | "contacted"
  | "responded"
  | "scoping_call"
  | "proposal"
  | "won"
  | "lost";

export type OfferingType = "software" | "integration" | "ai" | "automation";

export type EmailDirection = "outbound" | "inbound";

export type EmailStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "failed";

export type ResponseIntent =
  | "meeting"
  | "more_info"
  | "not_interested"
  | "out_of_office"
  | "unclear";

export type ActivityType =
  | "lead_created"
  | "email_sent"
  | "email_received"
  | "stage_changed"
  | "briefing_generated"
  | "followup_sent"
  | "note_added"
  | "lead_scored";

// Database row types

export interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_email: string | null;
  industry: string;
  location: string;
  website: string | null;
  stage: LeadStage;
  score: number;
  offering: OfferingType | null;
  frustration: string | null;
  notes: string | null;
  source: string | null;
  last_activity: string | null;
  followup_count: number;
  stale: boolean;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  lead_id: string;
  direction: EmailDirection;
  status: EmailStatus;
  resend_id: string | null;
  from_address: string;
  to_address: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  intent: ResponseIntent | null;
  intent_summary: string | null;
  is_followup: boolean;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  id: string;
  lead_id: string;
  summary: string;
  talking_points: string[];
  company_intel: string[];
  response_context: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  lead_id: string | null;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface OutreachTemplate {
  id: string;
  name: string;
  offering: OfferingType | null;
  industry: string | null;
  subject: string;
  body: string;
  is_followup: boolean;
  sequence: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

// View types

export interface DashboardStats {
  total_leads: number;
  identified: number;
  contacted: number;
  responded: number;
  scoping_call: number;
  proposal_stage: number;
  won: number;
  lost: number;
  avg_score: number;
  leads_today: number;
}

export interface EmailStats {
  sent: number;
  received: number;
  delivered: number;
  opened: number;
  bounced: number;
  response_rate: number;
}

// Service types

export interface CompanyCandidate {
  companyNumber: string;
  name: string;
  location: string;
  sicCodes: string[];
  incorporatedDate: string;
  industry: string;
  source: string;
}

export interface EnrichedLead {
  company: string;
  contactName: string;
  contactEmail: string | null;
  industry: string;
  location: string;
  website: string | null;
  frustration: string;
  offering: OfferingType;
  source: string;
  notes: string | null;
  websiteLooksOutdated?: boolean;
  estimatedEmployees?: number;
  frustrationScore?: number;
  recencyScore?: number;
}

export interface ScoredLead extends EnrichedLead {
  score: number;
}

export interface DiscoveryResult {
  discovered: number;
  leads: Lead[];
  skipped: number;
  errors: string[];
}

export interface OutreachResult {
  email_id: string;
  resend_id: string | null;
  subject: string;
  status: string;
}

export interface FollowupResult {
  followups_sent: number;
  leads_marked_stale: number;
  details: Array<{
    lead_id: string;
    company: string;
    sequence: number;
  }>;
}

export interface InboundResult {
  matched: boolean;
  leadId?: string;
  intent?: ResponseIntent;
  intentSummary?: string;
  briefingGenerated?: boolean;
}

export interface IntentResult {
  intent: ResponseIntent;
  summary: string;
  meeting_preference: string | null;
  questions: string[];
}

export interface BriefingResult {
  briefing_id: string;
  summary: string;
  talking_points: string[];
  company_intel: string[];
}

export interface DraftedEmail {
  subject: string;
  body_html: string;
  body_text: string;
}

// Resend webhook types

export interface ResendEvent {
  type: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    html?: string;
    text?: string;
  };
}

export interface ResendInboundPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Offering descriptions for prompts

export const OFFERING_DESCRIPTIONS: Record<OfferingType, string> = {
  software:
    "Custom software that replaces manual processes with a purpose-built tool",
  integration:
    "Systems integration to connect disconnected tools and eliminate duplicate data entry",
  ai: "AI implementation for document processing, data extraction, or predictive analysis",
  automation:
    "Process automation to remove repetitive tasks and reduce human error",
};

// Analytics view types

export interface WeeklyTrend {
  week_start: string;
  week_label: string;
  leads_discovered: number;
  emails_sent: number;
  followups_sent: number;
  responses_received: number;
  briefings_generated: number;
  response_rate: number;
}

export interface FunnelStage {
  stage: string;
  stage_rank: number;
  lead_count: number;
  pct_of_total: number;
}

export interface IndustryBreakdown {
  industry: string;
  total_leads: number;
  contacted: number;
  responded: number;
  won: number;
  response_rate: number;
  avg_score: number;
}

export interface OfferingBreakdown {
  offering: OfferingType;
  total_leads: number;
  contacted: number;
  responded: number;
  won: number;
  response_rate: number;
}

// Calendar and meetings types

export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface Meeting {
  id: string;
  lead_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  status: MeetingStatus;
  google_event_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingWithLead extends Meeting {
  lead: Pick<Lead, "id" | "company" | "contact_name" | "contact_email" | "industry">;
}

export interface OAuthToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

// Unified calendar event (portal meetings + Google Calendar events)

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location: string | null;
  source: "portal" | "google";
  leadId?: string;
  status?: string;
  contactName?: string;
  htmlLink?: string | null;
}
