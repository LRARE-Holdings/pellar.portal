import { createClient } from "@/lib/supabase/server";
import { CalendarGrid, UpcomingMeetings } from "@/components/calendar-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Meeting, MeetingWithLead, Lead } from "@/types";

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all meetings with lead data
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

  // Check Google Calendar connection
  let hasGoogleCalendar = false;
  if (user) {
    const { data: token } = await supabase
      .from("oauth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();
    hasGoogleCalendar = !!token;
  }

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
          meetings={meetingsWithLeads}
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth()}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Upcoming Meetings
        </h2>
        <div className="mt-3">
          <UpcomingMeetings meetings={meetingsWithLeads} />
        </div>
      </div>
    </div>
  );
}
