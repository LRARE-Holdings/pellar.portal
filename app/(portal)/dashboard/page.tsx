import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { ActionItemsPanel } from "@/components/action-items-panel";
import { PipelineValueBars } from "@/components/pipeline-value-bars";
import { WeeklyChart } from "@/components/analytics-weekly-chart";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type {
  DashboardStats,
  EmailStats,
  ActionItem,
  PipelineValue,
  ActivityLogEntry,
  WeeklyTrend,
  IndustryBreakdown,
  Email,
  Lead,
  Meeting,
} from "@/types";

function formatGBP(value: number): string {
  if (value === 0) return "GBP 0";
  return `GBP ${value.toLocaleString("en-GB")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [
    statsResult,
    emailStatsResult,
    actionItemsResult,
    pipelineValueResult,
    activityResult,
    upcomingMeetingsResult,
    recentResponsesResult,
    weeklyTrendsResult,
    industryResult,
    emailsTodayResult,
  ] = await Promise.all([
    supabase.from("dashboard_stats").select("*").single(),
    supabase.from("email_stats").select("*").single(),
    supabase.from("action_items").select("*").limit(15),
    supabase.from("pipeline_value").select("*"),
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("meetings")
      .select("*, leads(company, contact_name)")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", nextWeek.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(7),
    supabase
      .from("emails")
      .select("*, leads(company)")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("analytics_weekly_trends")
      .select("*")
      .order("week_start", { ascending: true }),
    supabase
      .from("analytics_industry_breakdown")
      .select("*")
      .order("response_rate", { ascending: false })
      .limit(5),
    supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", todayStart.toISOString()),
  ]);

  const stats = (statsResult.data || {}) as DashboardStats;
  const emailStats = (emailStatsResult.data || {}) as EmailStats;
  const actionItems = (actionItemsResult.data || []) as ActionItem[];
  const pipelineValues = (pipelineValueResult.data || []) as PipelineValue[];
  const activity = (activityResult.data || []) as ActivityLogEntry[];
  const upcomingMeetings = (upcomingMeetingsResult.data || []) as Array<
    Meeting & { leads: Pick<Lead, "company" | "contact_name"> | null }
  >;
  const recentResponses = (recentResponsesResult.data || []) as Array<
    Email & { leads: Pick<Lead, "company"> | null }
  >;
  const weeklyTrends = (weeklyTrendsResult.data || []) as WeeklyTrend[];
  const industries = (industryResult.data || []) as IndustryBreakdown[];
  const emailsToday = emailsTodayResult.count || 0;

  const activePipeline = pipelineValues
    .filter((p) => !["identified", "won"].includes(p.stage))
    .reduce((sum, p) => sum + p.lead_count, 0);

  const winRate =
    stats.won + stats.lost > 0
      ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
      : 0;

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Dashboard</h1>

      {/* Row 1: Stat cards */}
      <div className="mt-5 grid grid-cols-4 gap-3 xl:grid-cols-6 3xl:grid-cols-8">
        <StatCard label="Total Leads" value={stats.total_leads || 0} />
        <StatCard label="Active Pipeline" value={activePipeline} />
        <StatCard
          label="This Week"
          value={stats.leads_this_week || 0}
          subtitle="discovered"
        />
        <StatCard
          label="Emails Today"
          value={`${emailsToday} / 10`}
          subtitle="daily limit"
        />
        <StatCard
          label="Response Rate"
          value={`${emailStats.response_rate || 0}%`}
        />
        <StatCard
          label="Pipeline Value"
          value={formatGBP(stats.pipeline_value || 0)}
        />
        <StatCard label="Meetings This Week" value={upcomingMeetings.length} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
      </div>

      {/* Row 2: Three-column work zone */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 3xl:grid-cols-3">
        {/* Action items */}
        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Needs Attention
          </h2>
          <div className="mt-3">
            <ActionItemsPanel items={actionItems} />
          </div>
        </div>

        {/* Pipeline + Activity */}
        <div className="space-y-4">
          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Pipeline
            </h2>
            <div className="mt-3">
              <PipelineValueBars stages={pipelineValues} />
            </div>
          </div>

          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Recent Activity
            </h2>
            <div className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto">
              {activity.length === 0 && (
                <p className="text-sm text-stone">No activity yet.</p>
              )}
              {activity.map((entry) => (
                <div key={entry.id} className="flex gap-2 py-1">
                  <span className="shrink-0 text-[11px] text-stone">
                    {new Date(entry.created_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <p className="text-sm text-ink">{entry.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Meetings + Responses */}
        <div className="space-y-4">
          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Upcoming Meetings
            </h2>
            <div className="mt-3 space-y-2">
              {upcomingMeetings.length === 0 && (
                <p className="text-sm text-stone">No meetings this week.</p>
              )}
              {upcomingMeetings.map((meeting) => {
                const date = new Date(meeting.scheduled_at);
                return (
                  <Link
                    key={meeting.id}
                    href={`/leads/${meeting.lead_id}`}
                    className="block rounded-md px-2 py-1.5 transition-colors hover:bg-cream"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">
                        {meeting.leads?.company}
                      </span>
                      <span className="text-[11px] text-stone">
                        {date.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone">
                      {meeting.leads?.contact_name} at{" "}
                      {date.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({meeting.duration_minutes} min)
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Recent Responses
            </h2>
            <div className="mt-3 space-y-2">
              {recentResponses.length === 0 && (
                <p className="text-sm text-stone">No responses yet.</p>
              )}
              {recentResponses.map((email) => {
                const emailWithLeads = email as Email & { leads: { company: string } | null };
                return (
                  <Link
                    key={email.id}
                    href={`/leads/${email.lead_id}`}
                    className="block rounded-md px-2 py-1.5 transition-colors hover:bg-cream"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {emailWithLeads.leads?.company}
                      </span>
                      {email.intent && (
                        <Badge variant="sage">{email.intent}</Badge>
                      )}
                    </div>
                    {email.intent_summary && (
                      <p className="truncate text-[11px] text-stone">
                        {email.intent_summary}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Performance */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Weekly Performance
          </h2>
          <div className="mt-3">
            <WeeklyChart trends={weeklyTrends} />
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Top Industries
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-cream">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Industry
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Leads
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Rate
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {industries.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-stone"
                    >
                      No data yet.
                    </td>
                  </tr>
                )}
                {industries.map((ind) => (
                  <tr
                    key={ind.industry}
                    className="border-t border-warm-gray"
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-ink">
                      {ind.industry}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">
                      {ind.total_leads}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">
                      {ind.response_rate}%
                    </td>
                    <td className="px-4 py-2.5 text-sm text-stone">
                      {ind.avg_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
