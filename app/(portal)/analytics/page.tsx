import { createClient } from "@/lib/supabase/server";
import { WeeklyChart } from "@/components/analytics-weekly-chart";
import { AnalyticsFunnel } from "@/components/analytics-funnel";
import { AnalyticsExportButtons } from "@/components/analytics-export-buttons";
import type {
  WeeklyTrend,
  FunnelStage,
  IndustryBreakdown,
  OfferingBreakdown,
} from "@/types";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [trendsResult, funnelResult, industryResult, offeringResult, totalResult] =
    await Promise.all([
      supabase
        .from("analytics_weekly_trends")
        .select("*")
        .order("week_start", { ascending: true }),
      supabase
        .from("analytics_funnel")
        .select("*")
        .order("stage_rank"),
      supabase.from("analytics_industry_breakdown").select("*"),
      supabase.from("analytics_offering_breakdown").select("*"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("stale", false),
    ]);

  const trends = (trendsResult.data || []) as WeeklyTrend[];
  const funnel = (funnelResult.data || []) as FunnelStage[];
  const industries = (industryResult.data || []) as IndustryBreakdown[];
  const offerings = (offeringResult.data || []) as OfferingBreakdown[];

  const thisWeek = trends[trends.length - 1];
  const totalLeads = totalResult.count || 0;
  const totalEmails = trends.reduce((sum, t) => sum + t.emails_sent, 0);
  const totalResponses = trends.reduce(
    (sum, t) => sum + t.responses_received,
    0,
  );
  const overallResponseRate =
    totalEmails > 0 ? Math.round((totalResponses / totalEmails) * 100) : 0;
  const activePipeline = funnel
    .filter((f) => !["identified", "won"].includes(f.stage))
    .reduce((sum, f) => sum + f.lead_count, 0);

  return (
    <div>
      {/* Print-only header */}
      <div data-print-header className="hidden print:block print:mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-ink">
          PELLAR
        </p>
        <p className="text-[11px] text-stone">
          Analytics Report &mdash;{" "}
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-normal text-ink">Analytics</h1>
        <div data-print-hide>
          <AnalyticsExportButtons
            trends={trends}
            funnel={funnel}
            industries={industries}
            offerings={offerings}
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads} />
        <StatCard label="This Week" value={thisWeek?.leads_discovered || 0} />
        <StatCard label="Response Rate" value={`${overallResponseRate}%`} />
        <StatCard label="Active Pipeline" value={activePipeline} />
      </div>

      {/* Weekly Trends */}
      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Weekly Trends
        </h2>
        <div className="mt-3">
          <WeeklyChart trends={trends} />
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-cream">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Week
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Leads
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Emails
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Follow-ups
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Responses
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Rate
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Briefings
                </th>
              </tr>
            </thead>
            <tbody>
              {trends.slice(-8).map((week) => (
                <tr
                  key={week.week_label}
                  className="border-t border-warm-gray"
                >
                  <td className="px-4 py-3 text-sm font-medium text-ink">
                    {week.week_label}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {week.leads_discovered}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {week.emails_sent}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone">
                    {week.followups_sent}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {week.responses_received}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink">
                    {week.response_rate}%
                  </td>
                  <td className="px-4 py-3 text-sm text-stone">
                    {week.briefings_generated}
                  </td>
                </tr>
              ))}
              {trends.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-stone"
                  >
                    No weekly data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Conversion Funnel
        </h2>
        <div className="mt-3">
          <AnalyticsFunnel stages={funnel} />
        </div>
      </div>

      {/* Industry + Offering breakdown */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            By Industry
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-cream">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Industry
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Leads
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {industries.map((ind) => (
                  <tr
                    key={ind.industry}
                    className="border-t border-warm-gray"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-ink">
                      {ind.industry}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {ind.total_leads}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {ind.response_rate}%
                    </td>
                    <td className="px-4 py-3 text-sm text-stone">
                      {ind.avg_score}
                    </td>
                  </tr>
                ))}
                {industries.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-stone"
                    >
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            By Offering
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-cream">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Offering
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Leads
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Won
                  </th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((off) => (
                  <tr
                    key={off.offering}
                    className="border-t border-warm-gray"
                  >
                    <td className="px-4 py-3 text-sm font-medium capitalize text-ink">
                      {off.offering}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {off.total_leads}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {off.response_rate}%
                    </td>
                    <td className="px-4 py-3 text-sm text-stone">
                      {off.won}
                    </td>
                  </tr>
                ))}
                {offerings.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-stone"
                    >
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-light text-ink">{value}</p>
    </div>
  );
}
