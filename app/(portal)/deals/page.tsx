import Link from "next/link";
import { listDealsByStage, listDeals } from "@/lib/services/deals";
import { PageHeader } from "@/components/page-header";
import { DealKanban } from "@/components/deal-kanban";
import { Badge } from "@/components/ui/badge";
import { gbp, gbpCompact, relativeTime, dealStageVariant } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  view?: "kanban" | "table";
  search?: string;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = params.view ?? "kanban";

  if (view === "table") {
    const deals = await listDeals({ search: params.search });
    return (
      <div>
        <PageHeader
          title="Deals"
          subtitle={`${deals.length} active`}
          actions={<ViewSwitcher current={view} search={params.search} />}
        />
        <SearchInput defaultValue={params.search} />
        <div className="mt-4 overflow-hidden rounded-lg border border-warm-gray bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-warm-gray bg-cream text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              <tr>
                <th className="px-5 py-3">Deal</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3 text-right">Value</th>
                <th className="px-5 py-3 text-right">Weighted</th>
                <th className="px-5 py-3">Close</th>
                <th className="px-5 py-3">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="border-b border-warm-gray last:border-0 hover:bg-cream"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="font-medium text-ink hover:text-forest"
                    >
                      {deal.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {deal.company ? (
                      <Link
                        href={`/companies/${deal.company.id}`}
                        className="text-ink hover:text-forest"
                      >
                        {deal.company.name}
                      </Link>
                    ) : (
                      <span className="text-stone">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={dealStageVariant(deal.stage)}>
                      {deal.stage}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-ink">
                    {gbp(deal.value)}
                  </td>
                  <td className="px-5 py-3 text-right text-stone">
                    {gbp(deal.weighted_value)}
                  </td>
                  <td className="px-5 py-3 text-stone">
                    {deal.close_date ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-stone">
                    {relativeTime(deal.last_activity_at ?? deal.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: kanban
  const dealsByStage = await listDealsByStage();
  const totalActive = (
    ["lead", "qualified", "discovery", "proposal", "negotiation"] as const
  ).reduce((sum, s) => sum + dealsByStage[s].length, 0);
  const totalPipeline = (
    ["lead", "qualified", "discovery", "proposal", "negotiation"] as const
  )
    .flatMap((s) => dealsByStage[s])
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle={`${totalActive} active · ${gbpCompact(totalPipeline)} pipeline`}
        actions={<ViewSwitcher current={view} search={params.search} />}
      />
      <DealKanban dealsByStage={dealsByStage} />
    </div>
  );
}

function ViewSwitcher({
  current,
  search,
}: {
  current: string;
  search?: string;
}) {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
  return (
    <div className="flex items-center rounded-md border border-warm-gray bg-white p-0.5">
      <Link
        href={`/deals?view=kanban${searchParam}`}
        className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${
          current === "kanban" ? "rounded bg-cream text-ink" : "text-stone"
        }`}
      >
        Kanban
      </Link>
      <Link
        href={`/deals?view=table${searchParam}`}
        className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${
          current === "table" ? "rounded bg-cream text-ink" : "text-stone"
        }`}
      >
        Table
      </Link>
    </div>
  );
}

function SearchInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <form className="mt-4">
      <input
        type="search"
        name="search"
        placeholder="Search deals"
        defaultValue={defaultValue ?? ""}
        className="w-full max-w-md rounded-lg border border-warm-gray bg-white px-4 py-2 text-[13px] text-ink placeholder:text-stone focus:border-forest focus:outline-none"
      />
      <input type="hidden" name="view" value="table" />
    </form>
  );
}
