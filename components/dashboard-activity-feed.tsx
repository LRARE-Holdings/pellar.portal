import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";
import type { TimelineEvent, TimelineEventType } from "@/types";

interface DashboardActivityFeedProps {
  events: TimelineEvent[];
}

const EVENT_LABELS: Partial<Record<TimelineEventType, string>> = {
  company_created: "Company",
  contact_created: "Contact",
  deal_created: "Deal",
  deal_stage_changed: "Stage",
  deal_value_changed: "Value",
  email_sent: "Email sent",
  email_received: "Email in",
  draft_created: "Draft",
  draft_approved: "Approved",
  draft_discarded: "Discarded",
  briefing_generated: "Briefing",
  meeting_scheduled: "Meeting",
  meeting_completed: "Met",
  meeting_cancelled: "Cancelled",
  note_added: "Note",
  task_created: "Task",
  task_completed: "Done",
  call_logged: "Call",
  linkedin_logged: "LinkedIn",
  tag_added: "Tag",
  tag_removed: "Tag",
  document_uploaded: "Doc",
  discovery_promoted: "Discovery",
  booking_created: "Booking",
  booking_cancelled: "Booking",
};

const EVENT_VARIANTS: Partial<
  Record<TimelineEventType, "forest" | "sage" | "stone" | "warning" | "danger">
> = {
  deal_created: "forest",
  deal_stage_changed: "sage",
  email_sent: "forest",
  email_received: "warning",
  draft_approved: "forest",
  meeting_scheduled: "sage",
  meeting_completed: "forest",
  task_completed: "forest",
  booking_created: "sage",
};

function eventHref(event: TimelineEvent): string {
  if (event.deal_id) return `/deals/${event.deal_id}`;
  if (event.company_id) return `/companies/${event.company_id}`;
  if (event.contact_id) return `/contacts/${event.contact_id}`;
  return "#";
}

export function DashboardActivityFeed({ events }: DashboardActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-stone">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {events.map((event, idx) => (
        <Link
          key={event.id}
          href={eventHref(event)}
          className={`flex items-start gap-3 px-1 py-3 transition-colors hover:bg-cream ${
            idx > 0 ? "border-t border-warm-gray" : ""
          }`}
        >
          <Badge variant={EVENT_VARIANTS[event.type] ?? "stone"}>
            {EVENT_LABELS[event.type] ?? event.type.replace(/_/g, " ")}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
            {event.description}
          </span>
          <span className="shrink-0 text-[11px] text-stone">
            {relativeTime(event.created_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
