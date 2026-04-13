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
  | "pending_review"
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
  | "lead_scored"
  | "email_found";

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
  deal_value: number | null;
  phone: string | null;
  linkedin_url: string | null;
  social_links: Record<string, string> | null;
  google_rating: number | null;
  google_reviews: number | null;
  estimated_revenue: string | null;
  estimated_employees: number | null;
  company_age_years: number | null;
  company_number: string | null;
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
  lead_id: string | null;
  deal_id: string | null;
  company_id: string | null;
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
  pipeline_value: number;
  leads_this_week: number;
  won_value: number;
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
  websiteLooksOutdated: boolean;
  estimatedEmployees: number;
  frustrationScore: number;
  recencyScore: number;
  phone: string | null;
  linkedinUrl: string | null;
  socialLinks: Record<string, string>;
  googleRating: number | null;
  googleReviews: number | null;
  estimatedRevenue: string | null;
  companyAgeYears: number | null;
  companyNumber: string;
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
  lead_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  status: MeetingStatus;
  google_event_id: string | null;
  source: string;
  external_event_id: string | null;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingWithRelations extends Meeting {
  company?: { id: string; name: string } | null;
  contact?: { id: string; name: string; email: string } | null;
  deal?: { id: string; title: string; stage: string } | null;
}

/** @deprecated Use MeetingWithRelations */
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
  companyId?: string;
  dealId?: string;
  leadId?: string;
  status?: string;
  contactName?: string;
  htmlLink?: string | null;
}

// Command centre view types

export type ActionType =
  | "high_score_uncontacted"
  | "responded_no_briefing"
  | "bounced_email"
  | "meeting_soon";

export interface ActionItem {
  lead_id: string;
  company: string;
  contact_name: string;
  score: number;
  stage: string;
  action_type: ActionType;
  action_label: string;
  priority: number;
  relevant_date: string;
}

export interface PipelineValue {
  stage: string;
  lead_count: number;
  total_value: number;
  avg_value: number;
}

export interface EmailDeliveryHealth {
  total_sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  failed: number;
  delivery_rate: number;
  bounce_rate: number;
  open_rate: number;
}

export interface ScoreDistribution {
  score_band: string;
  band_rank: number;
  lead_count: number;
}

export interface ResponseTimeMetrics {
  avg_response_hours: number;
  min_response_hours: number;
  max_response_hours: number;
  total_responses: number;
}

// ============================================================================
// Relationship-first CRM types (Phase 1+)
// ============================================================================

// Enums
export type DealStage =
  | "lead"
  | "qualified"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource =
  | "contact_form"
  | "referral"
  | "content"
  | "linkedin"
  | "event"
  | "outbound"
  | "discovery"
  | "manual"
  | "booking";

export type EntityType = "company" | "contact" | "deal";

export type DraftStatus = "draft" | "ready" | "approved" | "discarded";

export type DocumentType = "proposal" | "contract" | "requirements" | "misc";

export type MeetingSource = "portal" | "google";

export type DiscoveryStatus = "pending_review" | "accepted" | "rejected";

export type EmailRoutingStatus = "matched" | "unmatched" | "needs_review";

export type TimelineEventType =
  | "company_created"
  | "contact_created"
  | "deal_created"
  | "deal_stage_changed"
  | "deal_value_changed"
  | "email_sent"
  | "email_received"
  | "draft_created"
  | "draft_approved"
  | "draft_discarded"
  | "briefing_generated"
  | "meeting_scheduled"
  | "meeting_completed"
  | "meeting_cancelled"
  | "note_added"
  | "task_created"
  | "task_completed"
  | "call_logged"
  | "linkedin_logged"
  | "tag_added"
  | "tag_removed"
  | "document_uploaded"
  | "discovery_promoted"
  | "booking_created"
  | "booking_cancelled";

// Core entities

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
  linkedin_url: string | null;
  social_links: Record<string, string>;
  google_rating: number | null;
  google_reviews: number | null;
  estimated_revenue: string | null;
  estimated_employees: number | null;
  company_age_years: number | null;
  company_number: string | null;
  source: LeadSource;
  source_detail: Record<string, unknown>;
  fit_score: number | null;
  frustration_hypothesis: string | null;
  notes: string | null;
  owner_id: string | null;
  legacy_lead_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  do_not_contact: boolean;
  notes: string | null;
  source: LeadSource;
  source_detail: Record<string, unknown>;
  owner_id: string | null;
  legacy_lead_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  company_id: string;
  primary_contact_id: string | null;
  offering_id: string | null;
  title: string;
  stage: DealStage;
  value: number | null;
  close_date: string | null;
  probability_override: number | null;
  source: LeadSource;
  source_detail: Record<string, unknown>;
  notes: string | null;
  owner_id: string | null;
  legacy_lead_id: string | null;
  archived_at: string | null;
  last_activity_at: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DealContact {
  deal_id: string;
  contact_id: string;
  role: string | null;
  created_at: string;
}

export interface Offering {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  body: string | null;
  due_at: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  body: string;
  author_id: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface EntityTag {
  tag_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  in_reply_to_email_id: string | null;
  to_address: string;
  cc_addresses: string[] | null;
  subject: string;
  body_html: string;
  body_text: string;
  generated_by: "ai" | "user";
  ai_prompt_used: string | null;
  status: DraftStatus;
  approved_email_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  discarded_at: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  company_id: string | null;
  deal_id: string | null;
  document_type: DocumentType;
  title: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCandidate {
  id: string;
  company_name: string;
  company_number: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  estimated_employees: number | null;
  estimated_revenue: string | null;
  company_age_years: number | null;
  frustration_hypothesis: string | null;
  suggested_offering_id: string | null;
  fit_score: number | null;
  raw: Record<string, unknown>;
  status: DiscoveryStatus;
  promoted_company_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// Views

export interface DealForecast {
  id: string;
  company_id: string;
  title: string;
  stage: DealStage;
  value: number | null;
  close_date: string | null;
  probability: number;
  weighted_value: number;
  close_month: string | null;
}

export interface CompanyEngagement {
  company_id: string;
  name: string;
  contact_count: number;
  email_count: number;
  meeting_count: number;
  note_count: number;
  last_touch_at: string | null;
  engagement_score: number;
}

export type InboxItemKind =
  | "draft_ready"
  | "unanswered_inbound"
  | "task_overdue"
  | "meeting_soon"
  | "deal_stale";

export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  priority: number;
  sort_at: string;
  title: string;
  subtitle: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  source_id: string;
  metadata: Record<string, unknown>;
}

// Enriched join shapes used by the UI

export interface CompanyWithEngagement extends Company {
  engagement: CompanyEngagement | null;
  primary_contact: Contact | null;
  active_deal_count: number;
  total_pipeline_value: number;
}

export interface DealWithRelations extends Deal {
  company: Pick<Company, "id" | "name" | "industry" | "location" | "domain"> | null;
  primary_contact: Pick<Contact, "id" | "name" | "email" | "title"> | null;
  offering: Pick<Offering, "id" | "slug" | "name"> | null;
  probability: number;
  weighted_value: number;
}

export interface ContactWithCompany extends Contact {
  company: Pick<Company, "id" | "name" | "industry" | "location" | "domain"> | null;
}

export interface InboxItemWithRelations extends InboxItem {
  company: Pick<Company, "id" | "name"> | null;
  contact: Pick<Contact, "id" | "name" | "email"> | null;
  deal: Pick<Deal, "id" | "title" | "stage" | "value"> | null;
}

// ============================================================================
// Booking system types
// ============================================================================

export type BookingMeetingType = "in_person" | "google_meet";

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export type EnrichmentStatus = "pending" | "running" | "complete" | "failed";

export interface BookingAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingOverride {
  id: string;
  override_date: string;
  override_type: "available" | "blocked";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  meeting_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  visitor_name: string;
  visitor_email: string;
  visitor_company: string | null;
  visitor_message: string | null;
  service_interest: string | null;
  meeting_type: BookingMeetingType;
  slot_start: string;
  slot_end: string;
  duration_minutes: number;
  status: BookingStatus;
  google_event_id: string | null;
  google_meet_link: string | null;
  enrichment_status: EnrichmentStatus;
  briefing_id: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
}

// ============================================================================
// Dashboard metrics
// ============================================================================

export interface DashboardMetrics {
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  win_rate: number;
  deals_won_this_month: number;
  deals_won_value_this_month: number;
  avg_deal_size: number;
  active_deal_count: number;
  new_companies_this_week: number;
  open_tasks: number;
  overdue_tasks: number;
  inbox_count: number;
  upcoming_meetings_count: number;
}

export interface CalendarEventResult {
  eventId: string;
  meetLink: string | null;
}
