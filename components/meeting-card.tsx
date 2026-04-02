import { Badge } from "@/components/ui/badge";
import type { Meeting } from "@/types";

interface MeetingCardProps {
  meeting: Meeting;
}

const statusVariant: Record<
  string,
  "default" | "forest" | "sage" | "stone" | "warning" | "danger"
> = {
  scheduled: "forest",
  completed: "sage",
  cancelled: "stone",
  no_show: "danger",
};

export function MeetingCard({ meeting }: MeetingCardProps) {
  const date = new Date(meeting.scheduled_at);

  return (
    <div className="rounded-md border border-warm-gray bg-cream p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{meeting.title}</span>
        <Badge variant={statusVariant[meeting.status] || "default"}>
          {meeting.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-stone">
        {date.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}{" "}
        at{" "}
        {date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {meeting.duration_minutes} min
      </p>
      {meeting.google_event_id && (
        <p className="mt-0.5 text-[11px] text-sage">
          Synced to Google Calendar
        </p>
      )}
      {meeting.notes && (
        <p className="mt-1 text-[11px] text-stone">{meeting.notes}</p>
      )}
    </div>
  );
}
