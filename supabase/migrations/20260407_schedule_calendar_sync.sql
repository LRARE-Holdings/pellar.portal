-- ============================================================================
-- Schedule calendar-sync edge function via pg_cron + pg_net
-- ============================================================================
--
-- Replaces the Vercel cron, which Hobby plan can't run at 15-minute frequency.
-- The actual edge function lives at supabase/functions/calendar-sync/index.ts
-- and is deployed via `supabase functions deploy calendar-sync`.
--
-- Before running this migration on a fresh project, set two Vault secrets via
-- the Supabase dashboard (or vault.create_secret() in SQL):
--
--   calendar_sync_secret  — generate with `openssl rand -hex 32`. The same
--                           value must be set as the CALENDAR_SYNC_SECRET
--                           edge function secret.
--   calendar_sync_url     — https://<project-ref>.supabase.co/functions/v1/calendar-sync
--
-- Both are stored encrypted at rest by Supabase Vault.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent re-creation of the schedule.
DO $$
BEGIN
  PERFORM cron.unschedule('calendar-sync-15min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'calendar-sync-15min',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
