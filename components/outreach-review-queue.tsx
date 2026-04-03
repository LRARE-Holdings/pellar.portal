"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Email } from "@/types";

interface PendingEmail extends Email {
  leads: { company: string; contact_name: string } | null;
}

interface OutreachReviewQueueProps {
  emails: PendingEmail[];
}

export function OutreachReviewQueue({ emails }: OutreachReviewQueueProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function handleApprove(emailId: string) {
    setLoading((prev) => ({ ...prev, [emailId]: "approving" }));
    try {
      const res = await fetch("/api/outreach/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: emailId }),
      });
      if (res.ok) {
        setDismissed((prev) => new Set(prev).add(emailId));
        router.refresh();
      }
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[emailId];
        return next;
      });
    }
  }

  async function handleReject(emailId: string) {
    setLoading((prev) => ({ ...prev, [emailId]: "rejecting" }));
    try {
      const res = await fetch("/api/outreach/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: emailId }),
      });
      if (res.ok) {
        setDismissed((prev) => new Set(prev).add(emailId));
        router.refresh();
      }
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[emailId];
        return next;
      });
    }
  }

  const visible = emails.filter((e) => !dismissed.has(e.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((email) => (
        <ReviewCard
          key={email.id}
          email={email}
          loadingState={loading[email.id] || null}
          onApprove={() => handleApprove(email.id)}
          onReject={() => handleReject(email.id)}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  email,
  loadingState,
  onApprove,
  onReject,
}: {
  email: PendingEmail;
  loadingState: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const company = email.leads?.company || "Unknown company";
  const contact = email.leads?.contact_name || email.to_address;

  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{company}</span>
            <Badge variant="warning">pending review</Badge>
          </div>
          <p className="mt-1 text-[13px] text-stone">
            To: {contact} ({email.to_address})
          </p>
          <p className="mt-2 text-[13px] font-medium text-ink">
            {email.subject}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            disabled={!!loadingState}
          >
            {loadingState === "rejecting" ? "Rejecting..." : "Reject"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onApprove}
            disabled={!!loadingState}
          >
            {loadingState === "approving" ? "Sending..." : "Approve"}
          </Button>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-[11px] font-medium uppercase tracking-[0.05em] text-stone hover:text-ink"
      >
        {expanded ? "Hide preview" : "Show preview"}
      </button>

      {expanded && (
        <div className="mt-3 rounded border border-warm-gray bg-cream p-4 text-[13px] leading-relaxed text-ink">
          {email.body_text ? (
            email.body_text.split("\n").map((line, i) => (
              <p key={i} className={line.trim() === "" ? "mt-3" : ""}>
                {line}
              </p>
            ))
          ) : (
            <p className="text-stone">No preview available.</p>
          )}
        </div>
      )}
    </div>
  );
}
