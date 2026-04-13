import Link from "next/link";
import { gbpCompact, dealStageLabel } from "@/lib/format";

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

interface DashboardPipelineFunnelProps {
  stages: PipelineStage[];
}

const BAR_COLORS: Record<string, string> = {
  lead: "bg-stone",
  qualified: "bg-forest",
  discovery: "bg-forest",
  proposal: "bg-forest",
  negotiation: "bg-forest",
  lost: "bg-stone",
};

export function DashboardPipelineFunnel({
  stages,
}: DashboardPipelineFunnelProps) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const widthPct = Math.max((stage.value / maxValue) * 100, 2);
        const barColor = BAR_COLORS[stage.stage] ?? "bg-sage";

        return (
          <Link
            key={stage.stage}
            href={`/deals?stage=${stage.stage}`}
            className="group flex items-center gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-cream"
          >
            <span className="w-24 shrink-0 text-[13px] font-medium text-ink">
              {dealStageLabel(stage.stage)}
            </span>
            <div className="relative flex-1">
              <div className="h-6 w-full overflow-hidden rounded bg-cream">
                <div
                  className={`h-full rounded ${barColor} transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
            <span className="w-32 shrink-0 text-right text-[13px] text-stone">
              {stage.count} deal{stage.count !== 1 ? "s" : ""}
              <span className="ml-1.5 font-medium text-ink">
                {gbpCompact(stage.value)}
              </span>
            </span>
          </Link>
        );
      })}

      {stages.length === 0 && (
        <p className="py-4 text-center text-[13px] text-stone">
          No active deals in the pipeline.
        </p>
      )}
    </div>
  );
}
