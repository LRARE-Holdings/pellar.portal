import { createClient } from "@/lib/supabase/server";
import { CalendarGrid, UpcomingMeetings } from "@/components/calendar-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listEvents } from "@/lib/clients/google-calendar";
import type { MeetingWithRelations, CalendarEvent } from "@/types";

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch meetings with company/contact/deal relations (new schema)
  const { data: meetingsRaw } = await supabase
    .from("meetings")
    .select(
      "*, company:companies(id, name), contact:contacts(id, name, email), deal:deals(id, title, stage)",
    )
    .order("scheduled_at", { ascending: true });

  const meetings = (meetingsRaw || []) as MeetingWithRelations[];

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

      const rawEvents = await listEvents(
        user.id,
        timeMin.toISOString(),
        timeMax.toISOString(),
      );

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
  const portalEvents: CalendarEvent[] = meetings.map((m) => {
    const companyName = m.company?.name ?? "Unknown";
    const endTime = new Date(
      new Date(m.scheduled_at).getTime() + m.duration_minutes * 60 * 1000,
    );
    return {
      id: m.id,
      title: `${companyName}: ${m.title}`,
      start: m.scheduled_at,
      end: endTime.toISOString(),
      isAllDay: false,
      location: m.location,
      source: "portal" as const,
      companyId: m.company?.id,
      dealId: m.deal?.id ?? undefined,
      status: m.status,
      contactName: m.contact?.name,
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
