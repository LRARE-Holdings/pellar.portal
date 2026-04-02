import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Briefing, Lead } from "@/types";

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: briefing } = await supabase
    .from("briefings")
    .select("*")
    .eq("id", id)
    .single();

  if (!briefing) {
    notFound();
  }

  const typedBriefing = briefing as Briefing;

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", typedBriefing.lead_id)
    .single();

  const typedLead = lead as Lead | null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link
          href="/briefings"
          className="text-sm text-stone hover:text-ink"
        >
          Briefings
        </Link>
        <span className="text-sm text-stone">/</span>
        {typedLead && (
          <Link
            href={`/leads/${typedLead.id}`}
            className="text-sm text-stone hover:text-ink"
          >
            {typedLead.company}
          </Link>
        )}
      </div>

      <h1 className="mt-4 text-[28px] font-normal text-ink">
        Scoping Call Briefing
      </h1>
      {typedLead && (
        <p className="mt-1 text-sm text-stone">
          {typedLead.company} \u00b7 {typedLead.contact_name} \u00b7{" "}
          {typedLead.industry}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {/* Summary */}
        <div className="rounded-lg border border-warm-gray bg-white p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Situation Summary
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            {typedBriefing.summary}
          </p>
        </div>

        {/* Talking points */}
        <div className="rounded-lg border border-warm-gray bg-white p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Discussion Areas
          </h2>
          <div className="mt-3 space-y-3">
            {(typedBriefing.talking_points as string[]).map((point, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-sm font-light text-stone">
                  {idx + 1}.
                </span>
                <p className="text-sm text-ink">{point}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Company intel */}
        <div className="rounded-lg border border-warm-gray bg-white p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Company Intel
          </h2>
          <div className="mt-3 space-y-1.5">
            {(typedBriefing.company_intel as string[]).map((fact, idx) => (
              <p key={idx} className="text-sm text-ink">
                {fact}
              </p>
            ))}
          </div>
        </div>

        {/* Response context */}
        {typedBriefing.response_context && (
          <div className="rounded-lg border border-warm-gray bg-white p-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Their Response
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-stone">
              {typedBriefing.response_context}
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-[11px] text-stone">
        Generated{" "}
        {new Date(typedBriefing.created_at).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
