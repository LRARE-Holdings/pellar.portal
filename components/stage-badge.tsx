import { Badge } from "@/components/ui/badge";
import type { LeadStage } from "@/types";

const stageConfig: Record<
  LeadStage,
  { label: string; variant: "default" | "forest" | "sage" | "stone" | "warning" | "danger" }
> = {
  identified: { label: "Identified", variant: "default" },
  contacted: { label: "Contacted", variant: "sage" },
  responded: { label: "Responded", variant: "forest" },
  scoping_call: { label: "Scoping Call", variant: "forest" },
  proposal: { label: "Proposal", variant: "warning" },
  won: { label: "Won", variant: "forest" },
  lost: { label: "Lost", variant: "stone" },
};

export function StageBadge({
  stage,
  className,
}: {
  stage: LeadStage;
  className?: string;
}) {
  const config = stageConfig[stage];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
