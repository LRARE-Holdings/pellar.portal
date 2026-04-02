"use client";

import { useState } from "react";
import { StageBadge } from "@/components/stage-badge";
import { ScoreDot } from "@/components/score-dot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { triggerOutreach, triggerBriefing } from "@/app/(portal)/leads/[id]/actions";
import type { Lead, Email, Briefing, ActivityLogEntry } from "@/types";

interface LeadDetailPanelProps {
  lead: Lead;
  emails: Email[];
  briefings: Briefing[];
  activity: ActivityLogEntry[];
}

export function LeadDetailPanel({
  lead,
  emails,
  briefings,
  activity,
}: LeadDetailPanelProps) {
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
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

  return (
    <div>
      {/* Lead header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-normal text-ink">{lead.company}</h1>
          <p className="mt-1 text-sm text-stone">
            {lead.contact_name}
            {lead.contact_email && ` \u00b7 ${lead.contact_email}`}
          </p>
          <p className="mt-0.5 text-sm text-stone">
            {lead.industry} \u00b7 {lead.location}
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
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-3 text-sm text-forest">{success}</p>
      )}

      {/* Details grid */}
      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
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
                    {(briefing.talking_points as string[]).map(
                      (point, idx) => (
                        <p key={idx} className="text-sm text-stone">
                          {idx + 1}. {point}
                        </p>
                      ),
                    )}
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
