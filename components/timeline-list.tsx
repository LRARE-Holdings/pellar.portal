import { relativeTime } from "@/lib/format";
import type { TimelineEvent, TimelineEventType } from "@/types";

const TYPE_LABEL: Partial<Record<TimelineEventType, string>> = {
  company_created: "Created",
  contact_created: "Contact added",
  deal_created: "Deal created",
  deal_stage_changed: "Stage changed",
  deal_value_changed: "Value changed",
  email_sent: "Sent email",
  email_received: "Received email",
  draft_created: "Draft created",
  draft_approved: "Draft approved",
  draft_discarded: "Draft discarded",
  briefing_generated: "Briefing generated",
  meeting_scheduled: "Meeting scheduled",
  meeting_completed: "Meeting completed",
  meeting_cancelled: "Meeting cancelled",
  note_added: "Note",
  task_created: "Task created",
  task_completed: "Task completed",
  call_logged: "Call logged",
  linkedin_logged: "LinkedIn",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  document_uploaded: "Document uploaded",
  discovery_promoted: "Promoted from discovery",
};

export function TimelineList({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-warm-gray bg-white p-5 text-[12px] text-stone">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warm-gray bg-white">
      {events.map((event, idx) => (
        <div
          key={event.id}
          className={`px-4 py-3 ${idx === 0 ? "" : "border-t border-warm-gray"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                {TYPE_LABEL[event.type] ?? event.type}
              </p>
              <p className="mt-0.5 break-words text-[13px] text-ink">
                {event.description}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-stone">
              {relativeTime(event.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
