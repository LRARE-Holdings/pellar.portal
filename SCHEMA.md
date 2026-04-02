# Database Schema

Supabase Postgres. All tables use `uuid` primary keys with `gen_random_uuid()` defaults. All tables include `created_at` and `updated_at` timestamps.

The Next.js app connects with the anon key (RLS-enforced) for authenticated user reads in server components, and the service role key (bypasses RLS) for writes in API routes, cron jobs, and server actions.

## Enums

```sql
CREATE TYPE lead_stage AS ENUM (
  'identified',
  'contacted',
  'responded',
  'scoping_call',
  'proposal',
  'won',
  'lost'
);

CREATE TYPE offering_type AS ENUM (
  'software',
  'integration',
  'ai',
  'automation'
);

CREATE TYPE email_direction AS ENUM (
  'outbound',
  'inbound'
);

CREATE TYPE email_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'opened',
  'bounced',
  'failed'
);

CREATE TYPE response_intent AS ENUM (
  'meeting',
  'more_info',
  'not_interested',
  'out_of_office',
  'unclear'
);

CREATE TYPE activity_type AS ENUM (
  'lead_created',
  'email_sent',
  'email_received',
  'stage_changed',
  'briefing_generated',
  'followup_sent',
  'note_added',
  'lead_scored'
);
```

## Tables

### leads

The core table. One row per prospect company.

```sql
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company         text NOT NULL,
  contact_name    text NOT NULL,
  contact_email   text,
  industry        text NOT NULL,
  location        text NOT NULL,
  website         text,
  stage           lead_stage NOT NULL DEFAULT 'identified',
  score           integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  offering        offering_type,
  frustration     text,
  notes           text,
  source          text,
  last_activity   timestamptz DEFAULT now(),
  followup_count  integer NOT NULL DEFAULT 0,
  stale           boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_industry ON leads(industry);
CREATE INDEX idx_leads_last_activity ON leads(last_activity DESC);
CREATE INDEX idx_leads_stale ON leads(stale) WHERE stale = false;
```

### emails

Every email sent or received, linked to a lead.

```sql
CREATE TABLE emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction       email_direction NOT NULL,
  status          email_status NOT NULL DEFAULT 'queued',
  resend_id       text,
  from_address    text NOT NULL,
  to_address      text NOT NULL,
  subject         text NOT NULL,
  body_html       text,
  body_text       text,
  intent          response_intent,
  intent_summary  text,
  is_followup     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emails_lead ON emails(lead_id);
CREATE INDEX idx_emails_direction ON emails(direction);
CREATE INDEX idx_emails_created ON emails(created_at DESC);
```

### briefings

AI-generated pre-call briefing documents.

```sql
CREATE TABLE briefings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  summary           text NOT NULL,
  talking_points    jsonb NOT NULL,
  company_intel     jsonb NOT NULL,
  response_context  text,
  generated_by      text DEFAULT 'claude',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefings_lead ON briefings(lead_id);
```

### activity_log

Chronological feed of everything that happens.

```sql
CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  type        activity_type NOT NULL,
  description text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_lead ON activity_log(lead_id);
CREATE INDEX idx_activity_type ON activity_log(type);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
```

### outreach_templates

Reusable email templates per offering type and industry.

```sql
CREATE TABLE outreach_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  offering    offering_type,
  industry    text,
  subject     text NOT NULL,
  body        text NOT NULL,
  is_followup boolean NOT NULL DEFAULT false,
  sequence    integer NOT NULL DEFAULT 1,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### profiles

Extends Supabase auth.users with portal-specific fields.

```sql
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        text NOT NULL DEFAULT 'member',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

## Row Level Security

All tables have RLS enabled. Authenticated users have full access (internal tool).

```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON leads
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON emails
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON briefings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON activity_log
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON outreach_templates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Triggers

### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON briefings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Auto-update `last_activity` on leads

```sql
CREATE OR REPLACE FUNCTION update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads SET last_activity = now() WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_activity_on_email
  AFTER INSERT ON emails
  FOR EACH ROW EXECUTE FUNCTION update_lead_last_activity();

CREATE TRIGGER update_lead_activity_on_briefing
  AFTER INSERT ON briefings
  FOR EACH ROW EXECUTE FUNCTION update_lead_last_activity();
```

### Auto-log stage changes

```sql
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO activity_log (lead_id, type, description, metadata)
    VALUES (
      NEW.id,
      'stage_changed',
      NEW.company || ' moved from ' || OLD.stage || ' to ' || NEW.stage,
      jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_lead_stage_change
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION log_stage_change();
```

## Views

### dashboard_stats

```sql
CREATE VIEW dashboard_stats AS
SELECT
  count(*) AS total_leads,
  count(*) FILTER (WHERE stage = 'identified') AS identified,
  count(*) FILTER (WHERE stage = 'contacted') AS contacted,
  count(*) FILTER (WHERE stage = 'responded') AS responded,
  count(*) FILTER (WHERE stage = 'scoping_call') AS scoping_call,
  count(*) FILTER (WHERE stage = 'proposal') AS proposal_stage,
  count(*) FILTER (WHERE stage = 'won') AS won,
  count(*) FILTER (WHERE stage = 'lost') AS lost,
  round(avg(score), 0) AS avg_score,
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS leads_today
FROM leads
WHERE stale = false;
```

### email_stats

```sql
CREATE VIEW email_stats AS
SELECT
  count(*) FILTER (WHERE direction = 'outbound') AS sent,
  count(*) FILTER (WHERE direction = 'inbound') AS received,
  count(*) FILTER (WHERE direction = 'outbound' AND status = 'delivered') AS delivered,
  count(*) FILTER (WHERE direction = 'outbound' AND status = 'opened') AS opened,
  count(*) FILTER (WHERE direction = 'outbound' AND status = 'bounced') AS bounced,
  CASE
    WHEN count(*) FILTER (WHERE direction = 'outbound') > 0
    THEN round(
      count(*) FILTER (WHERE direction = 'inbound')::numeric /
      count(DISTINCT lead_id) FILTER (WHERE direction = 'outbound')::numeric * 100, 1
    )
    ELSE 0
  END AS response_rate
FROM emails;
```
