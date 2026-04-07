import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listEvents, type GoogleCalendarEvent } from "@/lib/clients/google-calendar";
import { findContactByEmail } from "@/lib/services/contacts";

/**
 * Pull upcoming Google Calendar events into the `meetings` table.
 *
 * For each event:
 *  - if it already exists by external_event_id, update title/time
 *  - else insert a new row with source = 'google'
 *  - try to link to a contact + deal by attendee email
 *
 * Designed to run from a Vercel cron every 15 minutes for each authenticated
 * user. Solo for now → just pulls Alex's calendar.
 */
export async function syncCalendarForUser(userId: string): Promise<{
  fetched: number;
  inserted: number;
  updated: number;
  linked: number;
}> {
  const sb = getSupabaseAdmin();

  const now = new Date();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const events = await listEvents(
    userId,
    now.toISOString(),
    thirtyDaysAhead.toISOString(),
  );

  if (events.length === 0) {
    return { fetched: 0, inserted: 0, updated: 0, linked: 0 };
  }

  let inserted = 0;
  let updated = 0;
  let linked = 0;

  for (const event of events) {
    if (event.isAllDay) continue;

    // Try to link to a contact via attendees
    let contactId: string | null = null;
    let companyId: string | null = null;
    let dealId: string | null = null;

    for (const attendeeEmail of event.attendees) {
      const cleaned = attendeeEmail.toLowerCase();
      if (cleaned.endsWith("@pellar.co.uk")) continue; // skip Alex
      const contact = await findContactByEmail(cleaned);
      if (contact) {
        contactId = contact.id;
        companyId = contact.company_id;
        if (companyId) {
          // Find the most recent active deal on this company
          const { data: deals } = await sb
            .from("deals")
            .select("id")
            .eq("company_id", companyId)
            .is("archived_at", null)
            .not("stage", "in", "(won,lost)")
            .order("last_activity_at", { ascending: false, nullsFirst: false })
            .limit(1);
          if (deals && deals.length > 0) {
            dealId = deals[0].id;
            linked++;
          }
        }
        break;
      }
    }

    // Upsert by external_event_id
    const { data: existing } = await sb
      .from("meetings")
      .select("id")
      .eq("external_event_id", event.id)
      .maybeSingle();

    const meetingFields = {
      title: event.summary,
      scheduled_at: event.start,
      duration_minutes: durationMinutes(event),
      location: event.location,
      status: "scheduled" as const,
      source: "google" as const,
      external_event_id: event.id,
      company_id: companyId,
      contact_id: contactId,
      deal_id: dealId,
      owner_id: userId,
      notes: event.description,
    };

    if (existing) {
      await sb.from("meetings").update(meetingFields).eq("id", existing.id);
      updated++;
    } else {
      await sb.from("meetings").insert(meetingFields);
      inserted++;
    }
  }

  return { fetched: events.length, inserted, updated, linked };
}

function durationMinutes(event: GoogleCalendarEvent): number {
  if (!event.start || !event.end) return 30;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  if (isNaN(start) || isNaN(end)) return 30;
  return Math.max(15, Math.round((end - start) / 60000));
}
