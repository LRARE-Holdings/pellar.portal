import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/lib/format";

interface MeetingRow {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  deal_id?: string | null;
  company?: { id?: string; name: string } | null;
  contact?: { id?: string; name: string } | null;
}

interface DashboardMeetingsWidgetProps {
  meetings: MeetingRow[];
}

function locationBadge(location: string | null): {
  label: string;
  variant: "sage" | "stone";
} {
  if (!location) return { label: "TBC", variant: "stone" };
  const lower = location.toLowerCase();
  if (lower.includes("meet.google") || lower.includes("google meet")) {
    return { label: "Google Meet", variant: "sage" };
  }
  if (lower.includes("zoom")) {
    return { label: "Zoom", variant: "sage" };
  }
  if (lower.includes("teams")) {
    return { label: "Teams", variant: "sage" };
  }
  return { label: "In person", variant: "stone" };
}

export function DashboardMeetingsWidget({
  meetings,
}: DashboardMeetingsWidgetProps) {
  if (meetings.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-stone">
        No meetings this week.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {meetings.map((meeting, idx) => {
        const loc = locationBadge(meeting.location);
        const href = meeting.deal_id
          ? `/deals/${meeting.deal_id}`
          : "/calendar";

        return (
          <Link
            key={meeting.id}
            href={href}
            className={`flex items-start gap-3 px-1 py-3 transition-colors hover:bg-cream ${
              idx > 0 ? "border-t border-warm-gray" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">
                {meeting.title}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-stone">
                <span>{dateTime(meeting.scheduled_at)}</span>
                <span>·</span>
                <span>{meeting.duration_minutes}m</span>
              </div>
              {(meeting.company || meeting.contact) && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-stone">
                  {meeting.company && (
                    <span className="truncate">{meeting.company.name}</span>
                  )}
                  {meeting.company && meeting.contact && <span>·</span>}
                  {meeting.contact && (
                    <span className="truncate">{meeting.contact.name}</span>
                  )}
                </div>
              )}
            </div>
            <Badge variant={loc.variant}>{loc.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
