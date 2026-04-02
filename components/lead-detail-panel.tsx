"use client";

import { useState } from "react";
import { StageBadge } from "@/components/stage-badge";
import { ScoreDot } from "@/components/score-dot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeetingCard } from "@/components/meeting-card";
import {
  triggerOutreach,
  triggerBriefing,
  scheduleMeetingAction,
} from "@/app/(portal)/leads/[id]/actions";
import type { Lead, Email, Briefing, ActivityLogEntry, Meeting } from "@/types";

interface LeadDetailPanelProps {
  lead: Lead;
  emails: Email[];
  briefings: Briefing[];
  activity: ActivityLogEntry[];
  meetings: Meeting[];
}

export function LeadDetailPanel({
  lead,
  emails,
  briefings,
  activity,
  meetings,
}: LeadDetailPanelProps) {
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("14:00");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSendOutreach() {
    setSendingOutreach(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await triggerOutreach(lead.id);
      setSuccess(`Email sent: "${result.subject}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send outreach");
    } finally {
      setSendingOutreach(false);
    }
  }

  async function handleGenerateBriefing() {
    setGeneratingBriefing(true);
    setError(null);
    setSuccess(null);
    try {
      await triggerBriefing(lead.id);
      setSuccess("Briefing generated");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate briefing",
      );
    } finally {
      setGeneratingBriefing(false);
    }
  }

  async function handleScheduleMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingDate || !meetingTime) return;

    setSchedulingMeeting(true);
    setError(null);
    setSuccess(null);
    try {
      const scheduledAt = new Date(`${meetingDate}T${meetingTime}:00`).toISOString();
      await scheduleMeetingAction(
        lead.id,
        scheduledAt,
        meetingDuration,
        meetingNotes,
      );
      setSuccess("Meeting scheduled");
      setShowMeetingForm(false);
      setMeetingDate("");
      setMeetingTime("14:00");
      setMeetingDuration(30);
      setMeetingNotes("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to schedule meeting",
      );
    } finally {
      setSchedulingMeeting(false);
    }
  }

  const canScheduleMeeting =
    lead.contact_email &&
    ["responded", "scoping_call", "proposal"].includes(lead.stage);

  return (
    <div>
      {/* Lead header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-normal text-ink">{lead.company}</h1>
          <p className="mt-1 text-sm text-stone">
            {lead.contact_name}
            {lead.contact_email && ` · ${lead.contact_email}`}
          </p>
          <p className="mt-0.5 text-sm text-stone">
            {lead.industry} · {lead.location}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreDot score={lead.score} />
          <StageBadge stage={lead.stage} />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {lead.contact_email && lead.stage === "identified" && (
          <Button
            onClick={handleSendOutreach}
            disabled={sendingOutreach}
            size="sm"
          >
            {sendingOutreach ? "Sending..." : "Send Outreach"}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleGenerateBriefing}
          disabled={generatingBriefing}
          size="sm"
        >
          {generatingBriefing ? "Generating..." : "Generate Briefing"}
        </Button>
        {canScheduleMeeting && (
          <Button
            variant="secondary"
            onClick={() => setShowMeetingForm(!showMeetingForm)}
            size="sm"
          >
            Schedule Meeting
          </Button>
        )}
      </div>

      {/* Meeting scheduling form */}
      {showMeetingForm && (
        <form
          onSubmit={handleScheduleMeeting}
          className="mt-3 rounded-lg border border-warm-gray bg-white p-5"
        >
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Schedule Meeting
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-stone">
                Date
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
                className="w-full rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-stone">
                Time
              </label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                required
                className="w-full rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-stone">
                Duration
              </label>
              <select
                value={meetingDuration}
                onChange={(e) => setMeetingDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
              >
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium text-stone">
              Notes
            </label>
            <textarea
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-warm-gray bg-white px-3 py-2 text-sm text-ink placeholder:text-stone focus:border-forest focus:outline-none"
              placeholder="Any context for the meeting..."
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" disabled={schedulingMeeting}>
              {schedulingMeeting ? "Scheduling..." : "Confirm"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMeetingForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-forest">{success}</p>}

      {/* Details grid */}
      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Meetings */}
          {meetings.length > 0 && (
            <div className="rounded-lg border border-warm-gray bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
                Meetings
              </h2>
              <div className="mt-2 space-y-2">
                {meetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          )}

          {/* Frustration */}
          {lead.frustration && (
            <div className="rounded-lg border border-warm-gray bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
                Frustration Hypothesis
              </h2>
              <p className="mt-2 text-sm text-ink">{lead.frustration}</p>
            </div>
          )}

          {/* Offering */}
          {lead.offering && (
            <div className="rounded-lg border border-warm-gray bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
                Recommended Offering
              </h2>
              <Badge variant="forest" className="mt-2">
                {lead.offering}
              </Badge>
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div className="rounded-lg border border-warm-gray bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
                Notes
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Briefings */}
          {briefings.length > 0 && (
            <div className="rounded-lg border border-warm-gray bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
                Briefings
              </h2>
              {briefings.map((briefing) => (
                <div key={briefing.id} className="mt-3">
                  <p className="text-sm text-ink">{briefing.summary}</p>
                  <div className="mt-2 space-y-1">
                    {(briefing.talking_points as string[]).map((point, idx) => (
                      <p key={idx} className="text-sm text-stone">
                        {idx + 1}. {point}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Emails */}
          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Email History
            </h2>
            {emails.length === 0 && (
              <p className="mt-2 text-sm text-stone">No emails yet.</p>
            )}
            <div className="mt-2 space-y-3">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`rounded-md border p-3 ${
                    email.direction === "inbound"
                      ? "border-forest/20 bg-light-sage"
                      : "border-warm-gray bg-cream"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.03em] text-stone">
                      {email.direction === "outbound" ? "Sent" : "Received"}
                    </span>
                    <span className="text-[11px] text-stone">
                      {new Date(email.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {email.subject}
                  </p>
                  {email.intent && (
                    <Badge variant="sage" className="mt-1">
                      {email.intent}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Activity
            </h2>
            {activity.length === 0 && (
              <p className="mt-2 text-sm text-stone">No activity yet.</p>
            )}
            <div className="mt-2 space-y-2">
              {activity.map((entry) => (
                <div key={entry.id}>
                  <p className="text-sm text-ink">{entry.description}</p>
                  <p className="text-[11px] text-stone">
                    {new Date(entry.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
