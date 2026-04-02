import { createClient } from "@/lib/supabase/server";
import { CalendarGrid, UpcomingMeetings } from "@/components/calendar-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listEvents } from "@/lib/clients/google-calendar";
import type { Meeting, MeetingWithLead, Lead, CalendarEvent } from "@/types";

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all portal meetings
  const { data: meetingsRaw } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_at", { ascending: true });

  const meetings = (meetingsRaw || []) as Meeting[];

  // Fetch lead data for each meeting
  const leadIds = Array.from(new Set(meetings.map((m) => m.lead_id)));
  let leadMap: Record<
    string,
    Pick<Lead, "id" | "company" | "contact_name" | "contact_email" | "industry">
  > = {};

  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, company, contact_name, contact_email, industry")
      .in("id", leadIds);

    leadMap = Object.fromEntries(
      (
        (leads || []) as Pick<
          Lead,
          "id" | "company" | "contact_name" | "contact_email" | "industry"
        >[]
      ).map((l) => [l.id, l]),
    );
  }

  const meetingsWithLeads: MeetingWithLead[] = meetings
    .filter((m) => leadMap[m.lead_id])
    .map((m) => ({
      ...m,
      lead: leadMap[m.lead_id],
    }));

  // Check Google Calendar connection and fetch external events
  let hasGoogleCalendar = false;
  let googleEvents: CalendarEvent[] = [];

  if (user) {
    const { data: token } = await supabase
      .from("oauth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();
    hasGoogleCalendar = !!token;

    if (hasGoogleCalendar) {
      // Fetch 3 months of events (1 month back, 2 months forward)
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      timeMin.setDate(1);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 3);
      timeMax.setDate(0);

      const portalEventIds = new Set(
        meetings
          .map((m) => m.google_event_id)
          .filter((id): id is string => id !== null),
      );

      console.log("Calendar: fetching Google events", {
        userId: user.id,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });

      const rawEvents = await listEvents(
        user.id,
        timeMin.toISOString(),
        timeMax.toISOString(),
      );

      console.log("Calendar: Google events fetched", rawEvents.length);

      // Filter out events that are already portal meetings (avoid duplicates)
      googleEvents = rawEvents
        .filter((e) => !portalEventIds.has(e.id))
        .map((e) => ({
          id: e.id,
          title: e.summary,
          start: e.start,
          end: e.end,
          isAllDay: e.isAllDay,
          location: e.location,
          source: "google" as const,
          htmlLink: e.htmlLink,
        }));
    }
  }

  // Convert portal meetings to unified CalendarEvent format
  const portalEvents: CalendarEvent[] = meetingsWithLeads.map((m) => {
    const endTime = new Date(
      new Date(m.scheduled_at).getTime() + m.duration_minutes * 60 * 1000,
    );
    return {
      id: m.id,
      title: `${m.lead.company}: ${m.title}`,
      start: m.scheduled_at,
      end: endTime.toISOString(),
      isAllDay: false,
      location: m.location,
      source: "portal" as const,
      leadId: m.lead_id,
      status: m.status,
      contactName: m.lead.contact_name,
    };
  });

  const allEvents = [...portalEvents, ...googleEvents];

  const now = new Date();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-normal text-ink">Calendar</h1>
        <div className="flex items-center gap-3">
          {hasGoogleCalendar ? (
            <Badge variant="forest">Google Calendar connected</Badge>
          ) : (
            <a href="/api/auth/google">
              <Button variant="secondary" size="sm">
                Connect Google Calendar
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="mt-6">
        <CalendarGrid
          events={allEvents}
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth()}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Upcoming
        </h2>
        <div className="mt-3">
          <UpcomingMeetings events={allEvents} />
        </div>
      </div>
    </div>
  );
}
