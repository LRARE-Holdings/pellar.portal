import Link from "next/link";
import { ScoreDot } from "@/components/score-dot";
import type { Lead, LeadStage } from "@/types";

const PIPELINE_STAGES: { key: LeadStage; label: string }[] = [
  { key: "identified", label: "Identified" },
  { key: "contacted", label: "Contacted" },
  { key: "responded", label: "Responded" },
  { key: "scoping_call", label: "Scoping Call" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

interface PipelineBoardProps {
  leads: Lead[];
}

export function PipelineBoard({ leads }: PipelineBoardProps) {
  const grouped = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {grouped.map((column) => (
        <div key={column.key} className="w-56 shrink-0">
          <div className="flex items-center justify-between rounded-t-lg bg-cream px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              {column.label}
            </span>
            <span className="text-[11px] font-semibold text-stone">
              {column.leads.length}
            </span>
          </div>
          <div className="space-y-2 rounded-b-lg border border-warm-gray bg-white p-2">
            {column.leads.length === 0 && (
              <p className="py-4 text-center text-[11px] text-stone">
                No leads
              </p>
            )}
            {column.leads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="block rounded-md border border-warm-gray p-3 transition-colors hover:border-stone"
              >
                <p className="text-sm font-medium text-ink">{lead.company}</p>
                <p className="mt-0.5 text-[11px] text-stone">
                  {lead.contact_name}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-stone">
                    {lead.industry}
                  </span>
                  <ScoreDot score={lead.score} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
