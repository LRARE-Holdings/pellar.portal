-- ============================================================================
-- Pellar Portal — Relationship-First CRM Schema
-- ============================================================================
-- Migration: 20260407_rebuild_schema
--
-- Adds the new relationship-first data model alongside the existing `leads`
-- table. The legacy table is preserved through the migration window so the
-- old UI keeps working while the new UI is built. After Phase 6 cutover, the
-- old `leads` and `activity_log` tables are dropped.
--
-- Conventions:
--   * `owner_id` on every core entity, defaults to first user (Alex). RLS
--     stays permissive (authenticated full access) until a second user joins.
--   * Soft delete via `archived_at` (timestamp). No hard deletes from app.
--   * Timestamps use `timestamptz` and `now()`.
--   * Polymorphic links use `entity_type` enum + `entity_id` uuid.
--   * Probability is computed from stage via a function; per-deal override
--     is supported via `probability_override`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE deal_stage AS ENUM (
    'lead',
    'qualified',
    'discovery',
    'proposal',
    'negotiation',
    'won',
    'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM (
    'contact_form',
    'referral',
    'content',
    'linkedin',
    'event',
    'outbound',
    'discovery',
    'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM (
    'company',
    'contact',
    'deal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE timeline_event_type AS ENUM (
    'company_created',
    'contact_created',
    'deal_created',
    'deal_stage_changed',
    'deal_value_changed',
    'email_sent',
    'email_received',
    'draft_created',
    'draft_approved',
    'draft_discarded',
    'briefing_generated',
    'meeting_scheduled',
    'meeting_completed',
    'meeting_cancelled',
    'note_added',
    'task_created',
    'task_completed',
    'call_logged',
    'linkedin_logged',
    'tag_added',
    'tag_removed',
    'document_uploaded',
    'discovery_promoted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE draft_status AS ENUM (
    'draft',
    'ready',
    'approved',
    'discarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'proposal',
    'contract',
    'requirements',
    'misc'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meeting_source AS ENUM (
    'portal',
    'google'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discovery_status AS ENUM (
    'pending_review',
    'accepted',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_routing_status AS ENUM (
    'matched',
    'unmatched',
    'needs_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Helper: probability from stage
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION deal_default_probability(stage deal_stage)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE stage
    WHEN 'lead'        THEN 5
    WHEN 'qualified'   THEN 15
    WHEN 'discovery'   THEN 30
    WHEN 'proposal'    THEN 60
    WHEN 'negotiation' THEN 80
    WHEN 'won'         THEN 100
    WHEN 'lost'        THEN 0
  END;
$$;

-- ----------------------------------------------------------------------------
-- Helper: extract domain from a website URL
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION extract_domain(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF url IS NULL OR length(trim(url)) = 0 THEN
    RETURN NULL;
  END IF;
  cleaned := lower(trim(url));
  cleaned := regexp_replace(cleaned, '^https?://', '');
  cleaned := regexp_replace(cleaned, '^www\.', '');
  cleaned := split_part(cleaned, '/', 1);
  cleaned := split_part(cleaned, '?', 1);
  cleaned := split_part(cleaned, '#', 1);
  IF length(cleaned) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;

-- ----------------------------------------------------------------------------
-- Helper: bump updated_at on row update
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Offerings (replaces offering_type enum)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS offerings_set_updated_at ON offerings;
CREATE TRIGGER offerings_set_updated_at
  BEFORE UPDATE ON offerings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO offerings (slug, name, description, display_order)
VALUES
  ('software', 'Custom software',
   'Purpose-built tools that replace manual processes', 1),
  ('integration', 'Systems integration',
   'Connect disconnected tools and eliminate duplicate data entry', 2),
  ('ai', 'AI implementation',
   'Document processing, data extraction, predictive analysis', 3),
  ('automation', 'Process automation',
   'Remove repetitive tasks and reduce human error', 4)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Companies
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  website text,
  industry text,
  location text,
  phone text,
  linkedin_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  google_rating numeric(2,1),
  google_reviews integer,
  estimated_revenue text,
  estimated_employees integer,
  company_age_years integer,
  company_number text,
  source lead_source NOT NULL DEFAULT 'manual',
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  fit_score integer,
  frustration_hypothesis text,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_lead_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_domain
  ON companies(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_company_number
  ON companies(company_number) WHERE company_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_owner
  ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_archived
  ON companies(archived_at);
CREATE INDEX IF NOT EXISTS idx_companies_legacy_lead
  ON companies(legacy_lead_id) WHERE legacy_lead_id IS NOT NULL;

DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-derive domain from website if not provided
CREATE OR REPLACE FUNCTION companies_set_domain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.domain IS NULL AND NEW.website IS NOT NULL THEN
    NEW.domain := extract_domain(NEW.website);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_set_domain_trigger ON companies;
CREATE TRIGGER companies_set_domain_trigger
  BEFORE INSERT OR UPDATE OF website, domain ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_set_domain();

-- ----------------------------------------------------------------------------
-- Contacts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  linkedin_url text,
  is_primary boolean NOT NULL DEFAULT false,
  do_not_contact boolean NOT NULL DEFAULT false,
  notes text,
  source lead_source NOT NULL DEFAULT 'manual',
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_lead_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company
  ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email
  ON contacts(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_owner
  ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_archived
  ON contacts(archived_at);
CREATE INDEX IF NOT EXISTS idx_contacts_legacy_lead
  ON contacts(legacy_lead_id) WHERE legacy_lead_id IS NOT NULL;

-- One row per (company, lower(email)) pair, only when email present and not archived
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_company_email_unique
  ON contacts(company_id, lower(email))
  WHERE email IS NOT NULL AND archived_at IS NULL;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Deals
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  primary_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  offering_id uuid REFERENCES offerings(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'lead',
  value integer,
  close_date date,
  probability_override integer
    CHECK (probability_override IS NULL
           OR (probability_override >= 0 AND probability_override <= 100)),
  source lead_source NOT NULL DEFAULT 'manual',
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_lead_id uuid,
  archived_at timestamptz,
  last_activity_at timestamptz,
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_company
  ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_primary_contact
  ON deals(primary_contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage
  ON deals(stage) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_owner
  ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date
  ON deals(close_date);
CREATE INDEX IF NOT EXISTS idx_deals_last_activity
  ON deals(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_deals_legacy_lead
  ON deals(legacy_lead_id) WHERE legacy_lead_id IS NOT NULL;

DROP TRIGGER IF EXISTS deals_set_updated_at ON deals;
CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION deals_track_stage_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_track_stage_change_trigger ON deals;
CREATE TRIGGER deals_track_stage_change_trigger
  BEFORE UPDATE OF stage ON deals
  FOR EACH ROW EXECUTE FUNCTION deals_track_stage_change();

-- ----------------------------------------------------------------------------
-- Deal contacts (many-to-many)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deal_contacts (
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact
  ON deal_contacts(contact_id);

-- ----------------------------------------------------------------------------
-- Tasks (polymorphic, flat)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  due_at timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  entity_type entity_type,
  entity_id uuid,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_open
  ON tasks(owner_id, due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_entity
  ON tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due
  ON tasks(due_at) WHERE completed_at IS NULL;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Notes (polymorphic, markdown)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id uuid NOT NULL,
  body text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_entity
  ON notes(entity_type, entity_id, created_at DESC);

DROP TRIGGER IF EXISTS notes_set_updated_at ON notes;
CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Tags
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity
  ON entity_tags(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Timeline events (replaces activity_log)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type timeline_event_type NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_company
  ON timeline_events(company_id, created_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_contact
  ON timeline_events(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_deal
  ON timeline_events(deal_id, created_at DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_type
  ON timeline_events(type, created_at DESC);

-- ----------------------------------------------------------------------------
-- Email drafts (mutable working state — never mixed with sent emails)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  in_reply_to_email_id uuid,
  to_address text NOT NULL,
  cc_addresses text[],
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL,
  generated_by text NOT NULL DEFAULT 'ai',  -- 'ai' or 'user'
  ai_prompt_used text,
  status draft_status NOT NULL DEFAULT 'draft',
  approved_email_id uuid,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discarded_at timestamptz,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status
  ON email_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_deal
  ON email_drafts(deal_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_contact
  ON email_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_company
  ON email_drafts(company_id);

DROP TRIGGER IF EXISTS email_drafts_set_updated_at ON email_drafts;
CREATE TRIGGER email_drafts_set_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Idempotency: a draft can only transition to 'approved' once.
-- Partial unique index — ensures at most one row exists per id with status='approved'.
-- Combined with a status-transition guard in the service layer this prevents
-- the double-click double-send race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_drafts_approved_unique
  ON email_drafts(id) WHERE status = 'approved';

CREATE OR REPLACE FUNCTION email_drafts_guard_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Approved is terminal: can't go back to draft/ready/discarded.
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Cannot change status of an approved draft';
    END IF;
    -- Discarded is terminal too.
    IF OLD.status = 'discarded' AND NEW.status <> 'discarded' THEN
      RAISE EXCEPTION 'Cannot change status of a discarded draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_drafts_guard_status_trigger ON email_drafts;
CREATE TRIGGER email_drafts_guard_status_trigger
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION email_drafts_guard_status();

-- ----------------------------------------------------------------------------
-- Documents (Supabase Storage backed)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  document_type document_type NOT NULL DEFAULT 'misc',
  title text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_deal
  ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_company
  ON documents(company_id);

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Discovery candidates (throttled review queue)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_number text,
  domain text,
  website text,
  industry text,
  location text,
  contact_name text,
  contact_email text,
  contact_title text,
  phone text,
  linkedin_url text,
  google_rating numeric(2,1),
  google_reviews integer,
  estimated_employees integer,
  estimated_revenue text,
  company_age_years integer,
  frustration_hypothesis text,
  suggested_offering_id uuid REFERENCES offerings(id) ON DELETE SET NULL,
  fit_score integer,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  status discovery_status NOT NULL DEFAULT 'pending_review',
  promoted_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_candidates_status
  ON discovery_candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_candidates_company_number
  ON discovery_candidates(company_number) WHERE company_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Extend existing tables for new model (additive — old columns retained)
-- ----------------------------------------------------------------------------

-- emails: add deal/contact/company links + thread_id + routing_status
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS routing_status email_routing_status,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS source_draft_id uuid REFERENCES email_drafts(id) ON DELETE SET NULL;

-- emails.lead_id is currently NOT NULL — we need it nullable through migration window
ALTER TABLE emails ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emails_deal ON emails(deal_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_company ON emails(company_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id) WHERE thread_id IS NOT NULL;

-- Now that email_drafts.approved_email_id can reference real emails, add the FK
DO $$ BEGIN
  ALTER TABLE email_drafts
    ADD CONSTRAINT email_drafts_approved_email_fk
    FOREIGN KEY (approved_email_id) REFERENCES emails(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- briefings: add deal_id (lead_id stays nullable)
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE briefings ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_briefings_deal ON briefings(deal_id);
CREATE INDEX IF NOT EXISTS idx_briefings_company ON briefings(company_id);

-- meetings: add deal_id, source, external_event_id (lead_id stays nullable)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source meeting_source NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE meetings ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_deal ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company ON meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_external_event
  ON meetings(external_event_id) WHERE external_event_id IS NOT NULL;

-- leads: add migration tracking column
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS migrated_to_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_migrated
  ON leads(migrated_to_company_id) WHERE migrated_to_company_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Forecast view (weighted pipeline by close month)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW deal_forecast AS
SELECT
  d.id,
  d.company_id,
  d.title,
  d.stage,
  d.value,
  d.close_date,
  COALESCE(d.probability_override, deal_default_probability(d.stage)) AS probability,
  CASE
    WHEN d.value IS NULL THEN 0
    ELSE ROUND(d.value * COALESCE(d.probability_override,
                                   deal_default_probability(d.stage)) / 100.0)::integer
  END AS weighted_value,
  date_trunc('month', d.close_date)::date AS close_month
FROM deals d
WHERE d.archived_at IS NULL
  AND d.stage NOT IN ('won', 'lost');

-- ----------------------------------------------------------------------------
-- Engagement score view (replaces lead `score` for relationship signal)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW company_engagement AS
SELECT
  c.id AS company_id,
  c.name,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.archived_at IS NULL) AS contact_count,
  COUNT(DISTINCT e.id) AS email_count,
  COUNT(DISTINCT m.id) AS meeting_count,
  COUNT(DISTINCT n.id) AS note_count,
  GREATEST(
    MAX(e.created_at),
    MAX(m.scheduled_at),
    MAX(n.created_at),
    c.updated_at
  ) AS last_touch_at,
  -- Engagement score = touches × recency decay
  LEAST(100,
    (COUNT(DISTINCT e.id) * 5 +
     COUNT(DISTINCT m.id) * 15 +
     COUNT(DISTINCT n.id) * 3 +
     COUNT(DISTINCT ct.id) * 2)::integer
  ) AS engagement_score
FROM companies c
LEFT JOIN contacts ct ON ct.company_id = c.id
LEFT JOIN emails e ON e.company_id = c.id
LEFT JOIN meetings m ON m.company_id = c.id
LEFT JOIN notes n ON n.entity_type = 'company' AND n.entity_id = c.id
WHERE c.archived_at IS NULL
GROUP BY c.id, c.name, c.updated_at;

-- ----------------------------------------------------------------------------
-- Inbox view (drafts ready, unanswered inbound, stale deals, due tasks)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW inbox_items AS
-- Drafts awaiting approval
SELECT
  ('draft:' || id::text) AS id,
  'draft_ready'::text AS kind,
  1 AS priority,
  COALESCE(updated_at, created_at) AS sort_at,
  subject AS title,
  to_address AS subtitle,
  company_id,
  contact_id,
  deal_id,
  id AS source_id,
  jsonb_build_object('status', status, 'generated_by', generated_by) AS metadata
FROM email_drafts
WHERE status IN ('draft', 'ready')

UNION ALL

-- Inbound emails from the last 14 days that haven't had a draft reply created since
SELECT
  ('email:' || e.id::text) AS id,
  'unanswered_inbound'::text AS kind,
  2 AS priority,
  e.created_at AS sort_at,
  e.subject AS title,
  e.from_address AS subtitle,
  e.company_id,
  e.contact_id,
  e.deal_id,
  e.id AS source_id,
  jsonb_build_object('intent', e.intent, 'routing_status', e.routing_status) AS metadata
FROM emails e
WHERE e.direction = 'inbound'
  AND e.created_at >= now() - interval '14 days'
  AND NOT EXISTS (
    SELECT 1 FROM email_drafts d
    WHERE d.in_reply_to_email_id = e.id
      AND d.created_at > e.created_at
  )
  AND NOT EXISTS (
    SELECT 1 FROM emails out_e
    WHERE out_e.direction = 'outbound'
      AND out_e.deal_id = e.deal_id
      AND out_e.created_at > e.created_at
  )

UNION ALL

-- Overdue tasks
SELECT
  ('task:' || id::text) AS id,
  'task_overdue'::text AS kind,
  3 AS priority,
  due_at AS sort_at,
  title,
  body AS subtitle,
  CASE WHEN entity_type = 'company' THEN entity_id END,
  CASE WHEN entity_type = 'contact' THEN entity_id END,
  CASE WHEN entity_type = 'deal'    THEN entity_id END,
  id AS source_id,
  '{}'::jsonb AS metadata
FROM tasks
WHERE completed_at IS NULL
  AND due_at IS NOT NULL
  AND due_at < now()
  AND (snoozed_until IS NULL OR snoozed_until < now())

UNION ALL

-- Meetings today and tomorrow
SELECT
  ('meeting:' || id::text) AS id,
  'meeting_soon'::text AS kind,
  4 AS priority,
  scheduled_at AS sort_at,
  title,
  location AS subtitle,
  company_id,
  contact_id,
  deal_id,
  id AS source_id,
  jsonb_build_object('status', status, 'source', source) AS metadata
FROM meetings
WHERE status = 'scheduled'
  AND scheduled_at BETWEEN now() AND now() + interval '2 days'

UNION ALL

-- Stale deals (active stages, no activity for 10+ days)
SELECT
  ('stale:' || id::text) AS id,
  'deal_stale'::text AS kind,
  5 AS priority,
  COALESCE(last_activity_at, updated_at) AS sort_at,
  title,
  stage::text AS subtitle,
  company_id,
  primary_contact_id AS contact_id,
  id AS deal_id,
  id AS source_id,
  jsonb_build_object('value', value, 'stage', stage) AS metadata
FROM deals
WHERE archived_at IS NULL
  AND stage NOT IN ('won', 'lost', 'lead')
  AND COALESCE(last_activity_at, updated_at) < now() - interval '10 days';

-- ----------------------------------------------------------------------------
-- RLS — keep permissive (authenticated full access) until a 2nd user joins
-- ----------------------------------------------------------------------------

ALTER TABLE companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_candidates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'companies','contacts','deals','deal_contacts','offerings',
      'tasks','notes','tags','entity_tags','timeline_events',
      'email_drafts','documents','discovery_candidates'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_authenticated_all ON %I',
      t || '_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_all', t
    );
  END LOOP;
END $$;
