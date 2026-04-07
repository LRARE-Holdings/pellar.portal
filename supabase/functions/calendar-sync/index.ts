// Calendar sync — Supabase Edge Function (Deno)
//
// Pulls upcoming Google Calendar events for every user with a connected
// Google account and upserts them into the `meetings` table. Triggered by
// pg_cron via pg_net every 15 minutes (see schedule_calendar_sync migration).
//
// This file is a Deno-native port of lib/services/calendar-sync.ts +
// lib/clients/google-calendar.ts. It does not import any project code so it
// can run in the Edge Runtime without bundling Node modules.
//
// Required env (auto-injected by Supabase except where noted):
//   SUPABASE_URL                    — auto
//   SUPABASE_SERVICE_ROLE_KEY       — auto
//   GOOGLE_CLIENT_ID                — set via supabase secrets set
//   GOOGLE_CLIENT_SECRET            — set via supabase secrets set
//   CALENDAR_SYNC_SECRET            — shared secret in the Authorization header
//                                     so only pg_cron can trigger this

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface OAuthToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface GoogleEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  attendees: string[];
  htmlLink: string | null;
}

interface SyncResult {
  user_id: string;
  fetched: number;
  inserted: number;
  updated: number;
  linked: number;
  error?: string;
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Auth: require shared secret in Authorization header. pg_cron will pass
  // this. Reject everything else.
  const expected = Deno.env.get("CALENDAR_SYNC_SECRET");
  if (!expected) {
    return json({ error: "CALENDAR_SYNC_SECRET not configured" }, 500);
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: tokens, error } = await sb
    .from("oauth_tokens")
    .select("id, user_id, access_token, refresh_token, expires_at")
    .eq("provider", "google");

  if (error) {
    return json({ error: error.message }, 500);
  }

  const results: SyncResult[] = [];
  for (const token of (tokens ?? []) as OAuthToken[]) {
    try {
      const result = await syncForUser(sb, token);
      results.push(result);
    } catch (err) {
      results.push({
        user_id: token.user_id,
        fetched: 0,
        inserted: 0,
        updated: 0,
        linked: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({ users: results.length, results });
});

// ----------------------------------------------------------------------------
// Per-user sync
// ----------------------------------------------------------------------------

async function syncForUser(
  sb: ReturnType<typeof createClient>,
  token: OAuthToken,
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(sb, token);
  if (!accessToken) {
    return {
      user_id: token.user_id,
      fetched: 0,
      inserted: 0,
      updated: 0,
      linked: 0,
      error: "no_valid_token",
    };
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const events = await listGoogleEvents(
    accessToken,
    now.toISOString(),
    horizon.toISOString(),
  );

  let inserted = 0;
  let updated = 0;
  let linked = 0;

  for (const event of events) {
    if (event.isAllDay) continue;

    // Try to link via attendee email
    let contactId: string | null = null;
    let companyId: string | null = null;
    let dealId: string | null = null;

    for (const attendeeEmail of event.attendees) {
      const cleaned = attendeeEmail.toLowerCase();
      if (cleaned.endsWith("@pellar.co.uk")) continue;

      const { data: contactRow } = await sb
        .from("contacts")
        .select("id, company_id")
        .ilike("email", cleaned)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (contactRow) {
        contactId = contactRow.id as string;
        companyId = (contactRow.company_id as string | null) ?? null;
        if (companyId) {
          const { data: deals } = await sb
            .from("deals")
            .select("id")
            .eq("company_id", companyId)
            .is("archived_at", null)
            .not("stage", "in", "(won,lost)")
            .order("last_activity_at", { ascending: false, nullsFirst: false })
            .limit(1);
          if (deals && deals.length > 0) {
            dealId = deals[0].id as string;
            linked++;
          }
        }
        break;
      }
    }

    const meetingFields = {
      title: event.summary,
      scheduled_at: event.start,
      duration_minutes: durationMinutes(event),
      location: event.location,
      status: "scheduled",
      source: "google",
      external_event_id: event.id,
      company_id: companyId,
      contact_id: contactId,
      deal_id: dealId,
      owner_id: token.user_id,
      notes: event.description,
    };

    const { data: existing } = await sb
      .from("meetings")
      .select("id")
      .eq("external_event_id", event.id)
      .maybeSingle();

    if (existing) {
      await sb.from("meetings").update(meetingFields).eq("id", existing.id);
      updated++;
    } else {
      await sb.from("meetings").insert(meetingFields);
      inserted++;
    }
  }

  return {
    user_id: token.user_id,
    fetched: events.length,
    inserted,
    updated,
    linked,
  };
}

// ----------------------------------------------------------------------------
// Google OAuth — refresh + persist
// ----------------------------------------------------------------------------

async function getValidAccessToken(
  sb: ReturnType<typeof createClient>,
  token: OAuthToken,
): Promise<string | null> {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() >= 5 * 60 * 1000) {
    return token.access_token;
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return null;
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Token refresh failed:", await res.text());
    return null;
  }
  const refreshed = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await sb
    .from("oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt.toISOString(),
    })
    .eq("id", token.id);

  return refreshed.access_token;
}

// ----------------------------------------------------------------------------
// Google Calendar list events
// ----------------------------------------------------------------------------

async function listGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    console.error(`listEvents failed: ${res.status} ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      status?: string;
      attendees?: Array<{ email: string }>;
      htmlLink?: string;
    }>;
  };

  return (data.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({
      id: item.id,
      summary: item.summary || "(No title)",
      description: item.description ?? null,
      location: item.location ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? "",
      end: item.end?.dateTime ?? item.end?.date ?? "",
      isAllDay: !item.start?.dateTime,
      attendees: (item.attendees ?? []).map((a) => a.email),
      htmlLink: item.htmlLink ?? null,
    }));
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function durationMinutes(event: GoogleEvent): number {
  if (!event.start || !event.end) return 30;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  if (isNaN(start) || isNaN(end)) return 30;
  return Math.max(15, Math.round((end - start) / 60000));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
