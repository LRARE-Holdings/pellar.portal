import type { PipelineValue } from "@/types";

interface PipelineValueBarsProps {
  stages: PipelineValue[];
}

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  contacted: "Contacted",
  responded: "Responded",
  scoping_call: "Scoping Call",
  proposal: "Proposal",
  won: "Won",
};

function formatGBP(value: number): string {
  if (value === 0) return "GBP 0";
  if (value >= 1000) return `GBP ${Math.round(value / 1000)}k`;
  return `GBP ${value.toLocaleString("en-GB")}`;
}

export function PipelineValueBars({ stages }: PipelineValueBarsProps) {
  const maxCount = Math.max(...stages.map((s) => s.lead_count), 1);

  return (
    <div className="space-y-1.5">
      {stages.map((stage) => (
        <div key={stage.stage} className="flex items-center gap-2">
          <span className="w-20 text-right text-[11px] font-medium text-stone">
            {STAGE_LABELS[stage.stage] || stage.stage}
          </span>
          <div className="flex-1">
            <div
              className="flex h-6 items-center rounded bg-forest/15 px-2"
              style={{
                width: `${Math.max((stage.lead_count / maxCount) * 100, 8)}%`,
              }}
            >
              <span className="whitespace-nowrap text-[11px] font-medium text-forest">
                {stage.lead_count}
              </span>
            </div>
          </div>
          <span className="w-16 text-right text-[11px] text-stone">
            {formatGBP(stage.total_value)}
          </span>
        </div>
      ))}
    </div>
  );
}
