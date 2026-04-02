import { createClient } from "@/lib/supabase/server";
import { StageBadge } from "@/components/stage-badge";
import type { DashboardStats, EmailStats, Lead, ActivityLogEntry } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [statsResult, emailStatsResult, recentLeadsResult, activityResult] =
    await Promise.all([
      supabase.from("dashboard_stats").select("*").single(),
      supabase.from("email_stats").select("*").single(),
      supabase
        .from("leads")
        .select("*")
        .eq("stale", false)
        .order("last_activity", { ascending: false })
        .limit(5),
      supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const stats = (statsResult.data || {}) as DashboardStats;
  const emailStats = (emailStatsResult.data || {}) as EmailStats;
  const recentLeads = (recentLeadsResult.data || []) as Lead[];
  const activity = (activityResult.data || []) as ActivityLogEntry[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Dashboard</h1>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats.total_leads || 0} />
        <StatCard label="Contacted" value={stats.contacted || 0} />
        <StatCard label="Responded" value={stats.responded || 0} />
        <StatCard
          label="Response Rate"
          value={`${emailStats.response_rate || 0}%`}
        />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="Emails Sent" value={emailStats.sent || 0} />
        <StatCard label="Delivered" value={emailStats.delivered || 0} />
        <StatCard label="Opened" value={emailStats.opened || 0} />
        <StatCard label="Today" value={stats.leads_today || 0} />
      </div>

      {/* Pipeline summary */}
      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Pipeline
        </h2>
        <div className="mt-3 grid grid-cols-7 gap-3">
          <PipelineStage label="Identified" count={stats.identified || 0} />
          <PipelineStage label="Contacted" count={stats.contacted || 0} />
          <PipelineStage label="Responded" count={stats.responded || 0} />
          <PipelineStage label="Scoping" count={stats.scoping_call || 0} />
          <PipelineStage label="Proposal" count={stats.proposal_stage || 0} />
          <PipelineStage label="Won" count={stats.won || 0} />
          <PipelineStage label="Lost" count={stats.lost || 0} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        {/* Attention items */}
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Needs Attention
          </h2>
          <div className="mt-3 space-y-2">
            {recentLeads.length === 0 && (
              <p className="text-sm text-stone">No leads yet.</p>
            )}
            {recentLeads.map((lead) => (
              <a
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="block rounded-lg border border-warm-gray bg-white p-4 transition-colors hover:border-stone"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">
                    {lead.company}
                  </span>
                  <StageBadge stage={lead.stage} />
                </div>
                <p className="mt-1 text-xs text-stone">
                  {lead.contact_name} &middot; {lead.industry} &middot;{" "}
                  {lead.location}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Recent Activity
          </h2>
          <div className="mt-3 space-y-2">
            {activity.length === 0 && (
              <p className="text-sm text-stone">No activity yet.</p>
            )}
            {activity.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-warm-gray bg-white p-3"
              >
                <p className="text-sm text-ink">{entry.description}</p>
                <p className="mt-1 text-[11px] text-stone">
                  {new Date(entry.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
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

function PipelineStage({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-3 text-center">
      <p className="text-[20px] font-light text-ink">{count}</p>
      <p className="mt-0.5 text-[11px] font-medium text-stone">{label}</p>
    </div>
  );
}
