import Link from "next/link";
import type { Briefing } from "@/types";

interface BriefingCardProps {
  briefing: Briefing;
  companyName?: string;
}

export function BriefingCard({ briefing, companyName }: BriefingCardProps) {
  return (
    <Link
      href={`/briefings/${briefing.id}`}
      className="block rounded-lg border border-warm-gray bg-white p-5 transition-colors hover:border-stone"
    >
      {companyName && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.03em] text-stone">
          {companyName}
        </p>
      )}
      <p className="mt-1 text-sm text-ink">{briefing.summary}</p>
      <p className="mt-2 text-[11px] text-stone">
        {new Date(briefing.created_at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </Link>
  );
}
