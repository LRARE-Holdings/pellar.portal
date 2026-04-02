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
  stageValues?: Record<string, number>;
}

function formatGBP(value: number): string {
  if (value === 0) return "";
  if (value >= 1000) return `GBP ${Math.round(value / 1000)}k`;
  return `GBP ${value.toLocaleString("en-GB")}`;
}

export function PipelineBoard({ leads, stageValues }: PipelineBoardProps) {
  const grouped = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {grouped.map((column) => {
        const stageGBP = stageValues?.[column.key] || 0;
        return (
          <div key={column.key} className="min-w-[180px] flex-1">
            <div className="rounded-t-lg bg-cream px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  {column.label}
                </span>
                <span className="text-[11px] font-semibold text-stone">
                  {column.leads.length}
                </span>
              </div>
              {stageGBP > 0 && (
                <p className="text-[10px] text-sage">{formatGBP(stageGBP)}</p>
              )}
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
                  <p className="text-sm font-medium text-ink">
                    {lead.company}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone">
                    {lead.contact_name}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-stone">
                      {lead.industry}
                    </span>
                    <ScoreDot score={lead.score} />
                  </div>
                  {lead.deal_value != null && lead.deal_value > 0 && (
                    <p className="mt-1 text-[10px] text-stone">
                      GBP {lead.deal_value.toLocaleString("en-GB")}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
