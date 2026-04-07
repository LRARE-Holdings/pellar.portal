-- ============================================================================
-- Backfill: leads → companies + contacts + deals + timeline_events
-- ============================================================================
-- Idempotent. Safe to re-run. Uses legacy_lead_id as the link key.
-- Maps existing leads into the new relationship-first model:
--   * 1 company per lead
--   * 1 contact per lead (when contact_name is set and not "Unknown")
--   * 1 deal per lead, with stage mapped from old lead_stage
--   * Existing emails / briefings / meetings repointed via leads.migrated_to_company_id
--   * activity_log rows converted to timeline_events
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Companies
-- ----------------------------------------------------------------------------

WITH alex AS (
  SELECT id FROM auth.users WHERE email = 'alex@pellar.co.uk' LIMIT 1
),
inserted AS (
  INSERT INTO companies (
    name, website, industry, location, phone, linkedin_url, social_links,
    google_rating, google_reviews, estimated_revenue, estimated_employees,
    company_age_years, company_number, source, source_detail,
    fit_score, frustration_hypothesis, notes, owner_id, legacy_lead_id,
    created_at, updated_at
  )
  SELECT
    l.company,
    l.website,
    l.industry,
    l.location,
    l.phone,
    l.linkedin_url,
    COALESCE(l.social_links, '{}'::jsonb),
    l.google_rating,
    l.google_reviews,
    l.estimated_revenue,
    l.estimated_employees,
    l.company_age_years,
    l.company_number,
    'discovery'::lead_source,
    jsonb_build_object('legacy_source', l.source),
    l.score,
    l.frustration,
    l.notes,
    (SELECT id FROM alex),
    l.id,
    l.created_at,
    l.updated_at
  FROM leads l
  WHERE NOT EXISTS (
    SELECT 1 FROM companies c WHERE c.legacy_lead_id = l.id
  )
  RETURNING id, legacy_lead_id
)
UPDATE leads
SET migrated_to_company_id = inserted.id
FROM inserted
WHERE leads.id = inserted.legacy_lead_id;

-- Make sure existing migrated rows are also linked back (in case of partial run)
UPDATE leads l
SET migrated_to_company_id = c.id
FROM companies c
WHERE c.legacy_lead_id = l.id
  AND l.migrated_to_company_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Contacts (one per lead, when contact_name is meaningful)
-- ----------------------------------------------------------------------------

WITH alex AS (
  SELECT id FROM auth.users WHERE email = 'alex@pellar.co.uk' LIMIT 1
)
INSERT INTO contacts (
  company_id, name, email, phone, linkedin_url, is_primary,
  source, owner_id, legacy_lead_id, created_at, updated_at
)
SELECT
  l.migrated_to_company_id,
  l.contact_name,
  l.contact_email,
  l.phone,
  l.linkedin_url,
  true,
  'discovery'::lead_source,
  (SELECT id FROM alex),
  l.id,
  l.created_at,
  l.updated_at
FROM leads l
WHERE l.migrated_to_company_id IS NOT NULL
  AND l.contact_name IS NOT NULL
  AND l.contact_name <> 'Unknown'
  AND NOT EXISTS (
    SELECT 1 FROM contacts ct WHERE ct.legacy_lead_id = l.id
  );

-- ----------------------------------------------------------------------------
-- 3. Deals (one per lead, stage mapped from old lead_stage)
-- ----------------------------------------------------------------------------

WITH alex AS (
  SELECT id FROM auth.users WHERE email = 'alex@pellar.co.uk' LIMIT 1
),
mapped AS (
  SELECT
    l.id AS lead_id,
    l.migrated_to_company_id AS company_id,
    (SELECT id FROM contacts WHERE legacy_lead_id = l.id LIMIT 1) AS contact_id,
    (SELECT id FROM offerings WHERE slug = l.offering::text LIMIT 1) AS offering_id,
    -- Title: "{Company} — {Offering}" or just "{Company}"
    COALESCE(l.company || ' — ' || (
      SELECT name FROM offerings WHERE slug = l.offering::text LIMIT 1
    ), l.company) AS title,
    CASE l.stage::text
      WHEN 'identified'    THEN 'lead'::deal_stage
      WHEN 'contacted'     THEN 'qualified'::deal_stage
      WHEN 'responded'     THEN 'discovery'::deal_stage
      WHEN 'scoping_call'  THEN 'discovery'::deal_stage
      WHEN 'proposal'      THEN 'proposal'::deal_stage
      WHEN 'won'           THEN 'won'::deal_stage
      WHEN 'lost'          THEN 'lost'::deal_stage
      ELSE 'lead'::deal_stage
    END AS stage,
    l.deal_value,
    l.last_activity,
    l.created_at,
    l.updated_at
  FROM leads l
  WHERE l.migrated_to_company_id IS NOT NULL
)
INSERT INTO deals (
  company_id, primary_contact_id, offering_id, title, stage, value,
  source, owner_id, legacy_lead_id, last_activity_at, created_at, updated_at
)
SELECT
  m.company_id,
  m.contact_id,
  m.offering_id,
  m.title,
  m.stage,
  m.deal_value,
  'discovery'::lead_source,
  (SELECT id FROM alex),
  m.lead_id,
  m.last_activity,
  m.created_at,
  m.updated_at
FROM mapped m
WHERE NOT EXISTS (
  SELECT 1 FROM deals d WHERE d.legacy_lead_id = m.lead_id
);

-- ----------------------------------------------------------------------------
-- 4. Repoint emails to (company, contact, deal)
-- ----------------------------------------------------------------------------

UPDATE emails e
SET
  company_id = COALESCE(e.company_id, l.migrated_to_company_id),
  contact_id = COALESCE(e.contact_id, (
    SELECT id FROM contacts WHERE legacy_lead_id = l.id LIMIT 1
  )),
  deal_id = COALESCE(e.deal_id, (
    SELECT id FROM deals WHERE legacy_lead_id = l.id LIMIT 1
  )),
  routing_status = COALESCE(e.routing_status, 'matched'::email_routing_status)
FROM leads l
WHERE e.lead_id = l.id
  AND l.migrated_to_company_id IS NOT NULL
  AND (e.company_id IS NULL OR e.contact_id IS NULL OR e.deal_id IS NULL);

-- ----------------------------------------------------------------------------
-- 5. Repoint briefings to (company, deal)
-- ----------------------------------------------------------------------------

UPDATE briefings b
SET
  company_id = COALESCE(b.company_id, l.migrated_to_company_id),
  deal_id = COALESCE(b.deal_id, (
    SELECT id FROM deals WHERE legacy_lead_id = l.id LIMIT 1
  ))
FROM leads l
WHERE b.lead_id = l.id
  AND l.migrated_to_company_id IS NOT NULL
  AND (b.company_id IS NULL OR b.deal_id IS NULL);

-- ----------------------------------------------------------------------------
-- 6. Repoint meetings to (company, contact, deal)
-- ----------------------------------------------------------------------------

UPDATE meetings m
SET
  company_id = COALESCE(m.company_id, l.migrated_to_company_id),
  contact_id = COALESCE(m.contact_id, (
    SELECT id FROM contacts WHERE legacy_lead_id = l.id LIMIT 1
  )),
  deal_id = COALESCE(m.deal_id, (
    SELECT id FROM deals WHERE legacy_lead_id = l.id LIMIT 1
  ))
FROM leads l
WHERE m.lead_id = l.id
  AND l.migrated_to_company_id IS NOT NULL
  AND (m.company_id IS NULL OR m.deal_id IS NULL);

-- ----------------------------------------------------------------------------
-- 7. Convert activity_log → timeline_events
-- ----------------------------------------------------------------------------
-- Map old activity_type values to timeline_event_type:
--   lead_created       → company_created
--   email_sent         → email_sent
--   email_received     → email_received
--   stage_changed      → deal_stage_changed
--   briefing_generated → briefing_generated
--   followup_sent      → email_sent
--   note_added         → note_added
--   lead_scored        → company_created  (no good equivalent — collapse)
--   email_found        → company_created  (no good equivalent — collapse)
-- ----------------------------------------------------------------------------

INSERT INTO timeline_events (
  type, company_id, contact_id, deal_id, description, metadata, created_at
)
SELECT
  CASE a.type::text
    WHEN 'lead_created'       THEN 'company_created'::timeline_event_type
    WHEN 'email_sent'         THEN 'email_sent'::timeline_event_type
    WHEN 'email_received'     THEN 'email_received'::timeline_event_type
    WHEN 'stage_changed'      THEN 'deal_stage_changed'::timeline_event_type
    WHEN 'briefing_generated' THEN 'briefing_generated'::timeline_event_type
    WHEN 'followup_sent'      THEN 'email_sent'::timeline_event_type
    WHEN 'note_added'         THEN 'note_added'::timeline_event_type
    WHEN 'lead_scored'        THEN 'company_created'::timeline_event_type
    WHEN 'email_found'        THEN 'company_created'::timeline_event_type
    ELSE 'company_created'::timeline_event_type
  END,
  l.migrated_to_company_id,
  (SELECT id FROM contacts WHERE legacy_lead_id = l.id LIMIT 1),
  (SELECT id FROM deals WHERE legacy_lead_id = l.id LIMIT 1),
  a.description,
  COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object('legacy_activity_id', a.id),
  a.created_at
FROM activity_log a
JOIN leads l ON l.id = a.lead_id
WHERE l.migrated_to_company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM timeline_events te
    WHERE te.metadata ->> 'legacy_activity_id' = a.id::text
  );

-- ----------------------------------------------------------------------------
-- 8. Verification
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  lead_count integer;
  company_count integer;
  contact_count integer;
  deal_count integer;
  unmigrated_leads integer;
BEGIN
  SELECT count(*) INTO lead_count FROM leads;
  SELECT count(*) INTO company_count FROM companies WHERE legacy_lead_id IS NOT NULL;
  SELECT count(*) INTO contact_count FROM contacts WHERE legacy_lead_id IS NOT NULL;
  SELECT count(*) INTO deal_count FROM deals WHERE legacy_lead_id IS NOT NULL;
  SELECT count(*) INTO unmigrated_leads FROM leads WHERE migrated_to_company_id IS NULL;

  RAISE NOTICE 'Backfill verification:';
  RAISE NOTICE '  leads:          %', lead_count;
  RAISE NOTICE '  companies:      % (migrated)', company_count;
  RAISE NOTICE '  contacts:       % (migrated)', contact_count;
  RAISE NOTICE '  deals:          % (migrated)', deal_count;
  RAISE NOTICE '  unmigrated:     %', unmigrated_leads;

  IF company_count <> lead_count THEN
    RAISE EXCEPTION 'Migration count mismatch: leads=% companies=%',
      lead_count, company_count;
  END IF;

  IF deal_count <> lead_count THEN
    RAISE EXCEPTION 'Migration count mismatch: leads=% deals=%',
      lead_count, deal_count;
  END IF;

  IF unmigrated_leads > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % leads have no migrated_to_company_id',
      unmigrated_leads;
  END IF;
END $$;
