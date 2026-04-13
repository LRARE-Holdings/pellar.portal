import type { DealStage } from "@/types";

const STAGE_ORDER: DealStage[] = [
  "lead",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
];

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

interface StageProgressBarProps {
  currentStage: string;
  stageChangedAt: string | null;
}

export function StageProgressBar({
  currentStage,
  stageChangedAt,
}: StageProgressBarProps) {
  const isLost = currentStage === "lost";
  const currentIdx = STAGE_ORDER.indexOf(currentStage as DealStage);

  // Days in current stage
  const daysInStage = stageChangedAt
    ? Math.floor(
        (Date.now() - new Date(stageChangedAt).getTime()) / 86_400_000,
      )
    : 0;

  const daysColor =
    daysInStage <= 7
      ? "text-forest"
      : daysInStage <= 14
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div>
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stage, idx) => {
          const isPast = !isLost && idx < currentIdx;
          const isCurrent = !isLost && idx === currentIdx;

          return (
            <div key={stage} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  isPast
                    ? "bg-forest"
                    : isCurrent
                      ? "bg-forest"
                      : "bg-warm-gray"
                }`}
              />
              <span
                className={`text-[9px] font-semibold uppercase tracking-[0.03em] ${
                  isCurrent
                    ? "text-forest"
                    : isPast
                      ? "text-forest/60"
                      : "text-stone/50"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>
          );
        })}
      </div>

      {isLost && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1.5 w-full rounded-full bg-red-200" />
          <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.03em] text-red-600">
            Lost
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className={`text-[12px] font-semibold ${daysColor}`}>
          {daysInStage}d
        </span>
        <span className="text-[11px] text-stone">in current stage</span>
      </div>
    </div>
  );
}
