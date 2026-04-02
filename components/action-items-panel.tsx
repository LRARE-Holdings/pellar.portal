import Link from "next/link";
import { ScoreDot } from "@/components/score-dot";
import type { ActionItem } from "@/types";

interface ActionItemsPanelProps {
  items: ActionItem[];
}

const actionColour: Record<string, string> = {
  meeting_soon: "bg-forest",
  high_score_uncontacted: "bg-forest",
  responded_no_briefing: "bg-sage",
  bounced_email: "bg-red-500",
};

export function ActionItemsPanel({ items }: ActionItemsPanelProps) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-stone">
        Nothing needs attention right now.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.slice(0, 10).map((item) => (
        <Link
          key={`${item.lead_id}-${item.action_type}`}
          href={`/leads/${item.lead_id}`}
          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-cream"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${actionColour[item.action_type] || "bg-stone"}`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {item.company}
            </p>
            <p className="truncate text-[11px] text-stone">
              {item.action_label}
            </p>
          </div>
          <ScoreDot score={item.score} />
        </Link>
      ))}
      {items.length > 10 && (
        <p className="px-2 text-[11px] text-stone">
          +{items.length - 10} more
        </p>
      )}
    </div>
  );
}
