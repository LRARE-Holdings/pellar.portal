import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getInboxCount } from "@/lib/services/inbox";
import type { DashboardMetrics, DealStage } from "@/types";

/**
 * Stage-to-probability mapping for weighted pipeline calculation.
 * Won/lost are excluded from the pipeline.
 */
const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 0.05,
  qualified: 0.15,
  discovery: 0.3,
  proposal: 0.6,
  negotiation: 0.8,
  won: 1,
  lost: 0,
};

/**
 * Fetch every dashboard metric in parallel. Each sub-query is a small,
 * targeted Supabase call so the total wall time is roughly one round-trip.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const [
    activeDeals,
    wonAllTime,
    lostCount,
    wonThisMonth,
    openTasks,
    overdueTasks,
    inboxCount,
    newCompanies,
    upcomingMeetings,
  ] = await Promise.all([
    // Active deals (not won/lost, not archived) — need values and stages
    sb
      .from("deals")
      .select("value, stage")
      .not("stage", "in", "(won,lost)")
      .is("archived_at", null),

    // All won deals (for win rate + avg deal size)
    sb
      .from("deals")
      .select("value")
      .eq("stage", "won"),

    // Lost deals count (for win rate)
    sb
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("stage", "lost"),

    // Won this month (count + sum)
    sb
      .from("deals")
      .select("value")
      .eq("stage", "won")
      .gte("stage_changed_at", startOfMonth),

    // Open tasks
    sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null),

    // Overdue tasks
    sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .lt("due_at", now.toISOString()),

    // Inbox count
    getInboxCount(),

    // New companies this week
    sb
      .from("companies")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),

    // Upcoming meetings
    sb
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", sevenDaysFromNow),
  ]);

  // Pipeline value + weighted pipeline
  const activeDealRows = (activeDeals.data ?? []) as Array<{
    value: number | null;
    stage: DealStage;
  }>;

  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  for (const deal of activeDealRows) {
    const val = deal.value ?? 0;
    totalPipelineValue += val;
    weightedPipelineValue += val * (STAGE_PROBABILITY[deal.stage] ?? 0);
  }

  // Win rate
  const wonRows = (wonAllTime.data ?? []) as Array<{ value: number | null }>;
  const wonCount = wonRows.length;
  const lostTotal = lostCount.count ?? 0;
  const winRate =
    wonCount + lostTotal > 0
      ? Math.round((wonCount / (wonCount + lostTotal)) * 100)
      : 0;

  // Average deal size (won deals only)
  const wonValues = wonRows.map((d) => d.value ?? 0).filter((v) => v > 0);
  const avgDealSize =
    wonValues.length > 0
      ? Math.round(wonValues.reduce((a, b) => a + b, 0) / wonValues.length)
      : 0;

  // Won this month
  const wonThisMonthRows = (wonThisMonth.data ?? []) as Array<{
    value: number | null;
  }>;
  const dealsWonThisMonth = wonThisMonthRows.length;
  const dealsWonValueThisMonth = wonThisMonthRows.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0,
  );

  return {
    total_pipeline_value: totalPipelineValue,
    weighted_pipeline_value: Math.round(weightedPipelineValue),
    win_rate: winRate,
    deals_won_this_month: dealsWonThisMonth,
    deals_won_value_this_month: dealsWonValueThisMonth,
    avg_deal_size: avgDealSize,
    active_deal_count: activeDealRows.length,
    new_companies_this_week: newCompanies.count ?? 0,
    open_tasks: openTasks.count ?? 0,
    overdue_tasks: overdueTasks.count ?? 0,
    inbox_count: inboxCount,
    upcoming_meetings_count: upcomingMeetings.count ?? 0,
  };
}

/**
 * Week-over-week trend data for dashboard stat cards.
 */
export interface DashboardTrends {
  active_deals: { direction: "up" | "down" | "flat"; value: string };
  won_this_month: { direction: "up" | "down" | "flat"; value: string };
  pipeline_value: { direction: "up" | "down" | "flat"; value: string };
  meetings: { direction: "up" | "down" | "flat"; value: string };
}

function trendDir(current: number, previous: number): "up" | "down" | "flat" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function trendPct(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "new" : "";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${Math.abs(pct)}%`;
}

export async function getDashboardTrends(): Promise<DashboardTrends> {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const [
    currentNewDeals,
    previousNewDeals,
    currentWon,
    previousWon,
    currentMeetings,
    previousMeetings,
  ] = await Promise.all([
    sb.from("deals").select("id", { count: "exact", head: true })
      .not("stage", "in", "(won,lost)").is("archived_at", null).gte("created_at", d7),
    sb.from("deals").select("id", { count: "exact", head: true })
      .not("stage", "in", "(won,lost)").is("archived_at", null).gte("created_at", d14).lt("created_at", d7),
    sb.from("deals").select("id", { count: "exact", head: true })
      .eq("stage", "won").gte("stage_changed_at", d7),
    sb.from("deals").select("id", { count: "exact", head: true })
      .eq("stage", "won").gte("stage_changed_at", d14).lt("stage_changed_at", d7),
    sb.from("meetings").select("id", { count: "exact", head: true })
      .eq("status", "scheduled").gte("scheduled_at", now.toISOString()).lte("scheduled_at", sevenDaysFromNow),
    sb.from("meetings").select("id", { count: "exact", head: true })
      .gte("scheduled_at", d7).lte("scheduled_at", now.toISOString()),
  ]);

  return {
    active_deals: {
      direction: trendDir(currentNewDeals.count ?? 0, previousNewDeals.count ?? 0),
      value: trendPct(currentNewDeals.count ?? 0, previousNewDeals.count ?? 0),
    },
    won_this_month: {
      direction: trendDir(currentWon.count ?? 0, previousWon.count ?? 0),
      value: trendPct(currentWon.count ?? 0, previousWon.count ?? 0),
    },
    pipeline_value: { direction: "flat", value: "" },
    meetings: {
      direction: trendDir(currentMeetings.count ?? 0, previousMeetings.count ?? 0),
      value: trendPct(currentMeetings.count ?? 0, previousMeetings.count ?? 0),
    },
  };
}

/**
 * Upcoming bookings this week for the dashboard widget.
 */
export async function getUpcomingBookings(limit: number = 5) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { data, error } = await sb
    .from("bookings")
    .select("id, visitor_name, visitor_company, meeting_type, slot_start, status")
    .eq("status", "confirmed")
    .gte("slot_start", now)
    .lte("slot_start", sevenDaysFromNow)
    .order("slot_start", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch bookings: ${error.message}`);
  return data ?? [];
}

/**
 * Pipeline breakdown by stage. Used by the funnel chart.
 * Returns only active stages (excludes won/lost).
 */
export async function getPipelineByStage(): Promise<
  Array<{ stage: string; count: number; value: number }>
> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deals")
    .select("stage, value")
    .not("stage", "in", "(won,lost)")
    .is("archived_at", null);

  if (error) {
    throw new Error(`Failed to fetch pipeline stages: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ stage: string; value: number | null }>;

  const stageOrder: DealStage[] = [
    "lead",
    "qualified",
    "discovery",
    "proposal",
    "negotiation",
  ];

  const map = new Map<string, { count: number; value: number }>();
  for (const stage of stageOrder) {
    map.set(stage, { count: 0, value: 0 });
  }
  for (const row of rows) {
    const entry = map.get(row.stage);
    if (entry) {
      entry.count += 1;
      entry.value += row.value ?? 0;
    }
  }

  return stageOrder.map((stage) => ({
    stage,
    count: map.get(stage)?.count ?? 0,
    value: map.get(stage)?.value ?? 0,
  }));
}

/**
 * Recent timeline events across all entities.
 */
export async function getRecentTimelineEvents(limit: number = 20) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("timeline_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch timeline events: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Upcoming meetings with company and contact names.
 */
export async function getUpcomingMeetings(limit: number = 5) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(
    Date.now() + 7 * 86_400_000,
  ).toISOString();

  const { data, error } = await sb
    .from("meetings")
    .select(
      "id, title, scheduled_at, duration_minutes, location, deal_id, company_id, contact_id, status",
    )
    .eq("status", "scheduled")
    .gte("scheduled_at", now)
    .lte("scheduled_at", sevenDaysFromNow)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch meetings: ${error.message}`);
  }

  const meetings = data ?? [];
  if (meetings.length === 0) return [];

  // Hydrate with company + contact names
  const companyIds = [
    ...new Set(
      meetings.map((m) => m.company_id).filter(Boolean) as string[],
    ),
  ];
  const contactIds = [
    ...new Set(
      meetings.map((m) => m.contact_id).filter(Boolean) as string[],
    ),
  ];

  const [companies, contacts] = await Promise.all([
    companyIds.length > 0
      ? sb.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? sb.from("contacts").select("id, name").in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  const companyMap = new Map(
    (companies.data ?? []).map((c: { id: string; name: string }) => [
      c.id,
      c,
    ]),
  );
  const contactMap = new Map(
    (contacts.data ?? []).map((c: { id: string; name: string }) => [
      c.id,
      c,
    ]),
  );

  return meetings.map(
    (m: {
      id: string;
      title: string;
      scheduled_at: string;
      duration_minutes: number;
      location: string | null;
      deal_id: string | null;
      company_id: string | null;
      contact_id: string | null;
    }) => ({
      id: m.id,
      title: m.title,
      scheduled_at: m.scheduled_at,
      duration_minutes: m.duration_minutes,
      location: m.location,
      deal_id: m.deal_id,
      company: m.company_id ? companyMap.get(m.company_id) ?? null : null,
      contact: m.contact_id ? contactMap.get(m.contact_id) ?? null : null,
    }),
  );
}
