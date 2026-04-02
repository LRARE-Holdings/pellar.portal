import type { FunnelStage } from "@/types";

interface FunnelProps {
  stages: FunnelStage[];
}

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  contacted: "Contacted",
  responded: "Responded",
  scoping_call: "Scoping Call",
  proposal: "Proposal",
  won: "Won",
};

export function AnalyticsFunnel({ stages }: FunnelProps) {
  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-warm-gray bg-white p-5">
        <p className="text-sm text-stone">No funnel data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <span className="w-28 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              {STAGE_LABELS[stage.stage] || stage.stage}
            </span>
            <div className="flex-1">
              <div
                className="flex h-8 items-center rounded bg-forest/15 px-3"
                style={{
                  width: `${Math.max(stage.pct_of_total, 5)}%`,
                }}
              >
                <span className="whitespace-nowrap text-xs font-medium text-forest">
                  {stage.lead_count} ({stage.pct_of_total}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
