import Link from "next/link";
import { getForecast } from "@/lib/services/deals";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { gbp, gbpCompact, dealStageVariant } from "@/lib/format";
import type { DealForecast, DealStage } from "@/types";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const forecast = await getForecast();

  // Group by close month (or "Unscheduled")
  const groups = new Map<string, DealForecast[]>();
  for (const d of forecast) {
    const key = d.close_month
      ? new Date(d.close_month).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })
      : "Unscheduled";
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  const ordered = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "Unscheduled") return 1;
    if (b === "Unscheduled") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const totalPipeline = forecast.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0,
  );
  const totalWeighted = forecast.reduce(
    (sum, d) => sum + d.weighted_value,
    0,
  );

  // Find the largest single month for bar scaling
  const monthTotals = ordered.map(([month, deals]) => ({
    month,
    raw: deals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    weighted: deals.reduce((sum, d) => sum + d.weighted_value, 0),
  }));
  const maxMonth = Math.max(...monthTotals.map((m) => m.raw), 1);

  return (
    <div>
      <PageHeader
        title="Forecast"
        subtitle={`${gbpCompact(totalPipeline)} pipeline · ${gbpCompact(totalWeighted)} weighted`}
      />

      {forecast.length === 0 ? (
        <EmptyState
          title="No active deals"
          body="Add a close date and value to deals to start building a weighted forecast."
        />
      ) : (
        <>
          {/* Month bars overview */}
          <section className="mb-8 rounded-lg border border-warm-gray bg-white p-6">
            <SectionHeader>Pipeline by close month</SectionHeader>
            <div className="space-y-3">
              {monthTotals.map(({ month, raw, weighted }) => (
                <div key={month} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 text-[12px] text-stone">
                    {month}
                  </div>
                  <div className="relative flex-1">
                    <div className="h-6 overflow-hidden rounded bg-warm-gray">
                      <div
                        className="absolute left-0 top-0 h-6 bg-warm-gray"
                        style={{ width: `${(raw / maxMonth) * 100}%` }}
                      />
                      <div
                        className="absolute left-0 top-0 h-6 bg-forest"
                        style={{
                          width: `${(weighted / maxMonth) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-32 shrink-0 text-right text-[12px]">
                    <span className="font-medium text-ink">
                      {gbpCompact(weighted)}
                    </span>
                    <span className="text-stone"> / {gbpCompact(raw)}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-stone">
              Weighted = value × probability. Forest bars show weighted; grey
              shows raw.
            </p>
          </section>

          {/* Per-month detail */}
          <div className="space-y-8">
            {ordered.map(([month, deals]) => (
              <section key={month}>
                <SectionHeader>
                  {month}
                  <span className="ml-2 text-[11px] font-normal normal-case text-stone">
                    {deals.length} {deals.length === 1 ? "deal" : "deals"}
                  </span>
                </SectionHeader>
                <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-warm-gray bg-cream text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                      <tr>
                        <th className="px-5 py-3">Deal</th>
                        <th className="px-5 py-3">Stage</th>
                        <th className="px-5 py-3 text-right">Value</th>
                        <th className="px-5 py-3 text-right">Probability</th>
                        <th className="px-5 py-3 text-right">Weighted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-warm-gray last:border-0 hover:bg-cream"
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/deals/${d.id}`}
                              className="font-medium text-ink hover:text-forest"
                            >
                              {d.title}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant={dealStageVariant(d.stage as DealStage)}
                            >
                              {d.stage}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right text-ink">
                            {gbp(d.value)}
                          </td>
                          <td className="px-5 py-3 text-right text-stone">
                            {d.probability}%
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-forest">
                            {gbp(d.weighted_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
