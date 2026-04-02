import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Email } from "@/types";

interface EmailFeedProps {
  emails: Email[];
}

const statusVariant: Record<
  string,
  "default" | "forest" | "sage" | "stone" | "warning" | "danger"
> = {
  queued: "default",
  sent: "sage",
  delivered: "forest",
  opened: "forest",
  bounced: "danger",
  failed: "danger",
};

export function EmailFeed({ emails }: EmailFeedProps) {
  if (emails.length === 0) {
    return <p className="text-sm text-stone">No emails sent yet.</p>;
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => (
        <div
          key={email.id}
          className={`rounded-lg border bg-white p-4 ${
            email.direction === "inbound"
              ? "border-forest/20"
              : "border-warm-gray"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={email.direction === "inbound" ? "forest" : "default"}
              >
                {email.direction}
              </Badge>
              <Badge variant={statusVariant[email.status] || "default"}>
                {email.status}
              </Badge>
              {email.is_followup && <Badge variant="stone">Follow-up</Badge>}
            </div>
            <span className="text-[11px] text-stone">
              {new Date(email.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <Link
            href={`/leads/${email.lead_id}`}
            className="mt-2 block text-sm font-medium text-ink hover:text-forest"
          >
            {email.subject}
          </Link>
          <p className="mt-0.5 text-[11px] text-stone">
            {email.direction === "outbound" ? "To" : "From"}:{" "}
            {email.direction === "outbound"
              ? email.to_address
              : email.from_address}
          </p>
          {email.intent && (
            <div className="mt-1">
              <Badge variant="sage">{email.intent}</Badge>
              {email.intent_summary && (
                <span className="ml-2 text-xs text-stone">
                  {email.intent_summary}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
