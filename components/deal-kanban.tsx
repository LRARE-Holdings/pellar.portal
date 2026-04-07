import Link from "next/link";
import type { DealStage, DealWithRelations } from "@/types";
import { gbpCompact, relativeTime, dealStageVariant } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const STAGE_ORDER: DealStage[] = [
  "lead",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

const STAGE_LABEL: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export function DealKanban({
  dealsByStage,
}: {
  dealsByStage: Record<DealStage, DealWithRelations[]>;
}) {
  return (
    <div className="-mx-4 overflow-x-auto pb-4 md:-mx-8">
      <div className="flex min-w-max gap-4 px-4 md:px-8">
        {STAGE_ORDER.map((stage) => {
          const deals = dealsByStage[stage] ?? [];
          const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
          return (
            <div
              key={stage}
              className="flex w-[260px] shrink-0 flex-col rounded-lg border border-warm-gray bg-white"
            >
              <div className="border-b border-warm-gray px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    {STAGE_LABEL[stage]}
                  </h3>
                  <span className="text-[11px] font-medium text-stone">
                    {deals.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink">
                  {gbpCompact(total)}
                </p>
              </div>
              <div className="flex-1 space-y-2 p-3">
                {deals.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[11px] text-stone">
                    No deals
                  </p>
                ) : (
                  deals.map((deal) => <KanbanCard key={deal.id} deal={deal} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ deal }: { deal: DealWithRelations }) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-md border border-warm-gray bg-white p-3 transition-colors hover:border-forest/30 hover:bg-cream"
    >
      <p className="line-clamp-2 text-[13px] font-medium text-ink">
        {deal.title}
      </p>
      {deal.company && (
        <p className="mt-0.5 truncate text-[11px] text-stone">
          {deal.company.name}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">
          {gbpCompact(deal.value)}
        </span>
        <Badge variant={dealStageVariant(deal.stage)}>
          {Math.round(deal.probability)}%
        </Badge>
      </div>
      <p className="mt-1.5 text-[10px] text-stone">
        {relativeTime(deal.last_activity_at ?? deal.updated_at)}
      </p>
    </Link>
  );
}
