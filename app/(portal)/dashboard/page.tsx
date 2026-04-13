import { StatCard } from "@/components/stat-card";
import { DashboardQuickActions } from "@/components/dashboard-quick-actions";
import { DashboardPipelineFunnel } from "@/components/dashboard-pipeline-funnel";
import { DashboardActivityFeed } from "@/components/dashboard-activity-feed";
import { DashboardTaskWidget } from "@/components/dashboard-task-widget";
import { DashboardMeetingsWidget } from "@/components/dashboard-meetings-widget";
import { DashboardInboxWidget } from "@/components/dashboard-inbox-widget";
import { DashboardBookingsWidget } from "@/components/dashboard-bookings-widget";
import {
  getDashboardMetrics,
  getDashboardTrends,
  getPipelineByStage,
  getRecentTimelineEvents,
  getUpcomingMeetings,
  getUpcomingBookings,
} from "@/lib/services/dashboard-stats";
import { listDueTasks } from "@/lib/services/tasks";
import { listInboxItems } from "@/lib/services/inbox";
import { gbpCompact } from "@/lib/format";
import type { TimelineEvent, Task, InboxItemWithRelations } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    metrics,
    trends,
    pipelineStages,
    timelineEvents,
    meetings,
    bookings,
    tasks,
    inboxItems,
  ] = await Promise.all([
    getDashboardMetrics(),
    getDashboardTrends(),
    getPipelineByStage(),
    getRecentTimelineEvents(20),
    getUpcomingMeetings(7),
    getUpcomingBookings(5),
    listDueTasks({ limit: 8 }),
    listInboxItems(8),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-normal text-ink">Dashboard</h1>
        <DashboardQuickActions />
      </div>

      {/* Metric cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Pipeline Value"
          value={gbpCompact(metrics.weighted_pipeline_value)}
          subtitle="weighted"
          trend={trends.pipeline_value}
        />
        <StatCard
          label="Active Deals"
          value={metrics.active_deal_count}
          trend={trends.active_deals}
        />
        <StatCard
          label="Win Rate"
          value={`${metrics.win_rate}%`}
        />
        <StatCard
          label="Won This Month"
          value={metrics.deals_won_this_month}
          subtitle={gbpCompact(metrics.deals_won_value_this_month)}
          trend={trends.won_this_month}
        />
        <StatCard
          label="Inbox"
          value={metrics.inbox_count}
          subtitle="items"
        />
        <StatCard
          label="Meetings"
          value={metrics.upcoming_meetings_count}
          subtitle="this week"
          trend={trends.meetings}
        />
      </div>

      {/* Pipeline + Activity */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Pipeline
          </h2>
          <div className="mt-3">
            <DashboardPipelineFunnel stages={pipelineStages} />
          </div>
        </div>

        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Recent Activity
          </h2>
          <div className="mt-3">
            <DashboardActivityFeed
              events={timelineEvents as TimelineEvent[]}
            />
          </div>
        </div>
      </div>

      {/* Tasks + Meetings + Bookings + Inbox */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Tasks
          </h2>
          <div className="mt-3">
            <DashboardTaskWidget tasks={tasks as Task[]} />
          </div>
        </div>

        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Upcoming Meetings
          </h2>
          <div className="mt-3">
            <DashboardMeetingsWidget meetings={meetings} />
          </div>
        </div>

        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Bookings
          </h2>
          <div className="mt-3">
            <DashboardBookingsWidget bookings={bookings} />
          </div>
        </div>

        <div className="rounded-lg border border-warm-gray bg-white p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Inbox
          </h2>
          <div className="mt-3">
            <DashboardInboxWidget
              items={inboxItems as InboxItemWithRelations[]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
