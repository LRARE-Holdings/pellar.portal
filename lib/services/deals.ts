import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  Deal,
  DealForecast,
  DealStage,
  DealWithRelations,
  LeadSource,
} from "@/types";
import { logTimelineEvent } from "@/lib/services/timeline";

const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 5,
  qualified: 15,
  discovery: 30,
  proposal: 60,
  negotiation: 80,
  won: 100,
  lost: 0,
};

export function defaultProbability(stage: DealStage): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

export interface CreateDealInput {
  company_id: string;
  primary_contact_id?: string | null;
  offering_id?: string | null;
  title: string;
  stage?: DealStage;
  value?: number | null;
  close_date?: string | null;
  probability_override?: number | null;
  source?: LeadSource;
  source_detail?: Record<string, unknown>;
  notes?: string | null;
  owner_id?: string | null;
}

export interface UpdateDealInput {
  primary_contact_id?: string | null;
  offering_id?: string | null;
  title?: string;
  value?: number | null;
  close_date?: string | null;
  probability_override?: number | null;
  notes?: string | null;
  owner_id?: string | null;
}

export async function createDeal(
  input: CreateDealInput,
  actorId?: string | null,
): Promise<Deal> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deals")
    .insert({
      ...input,
      stage: input.stage ?? "lead",
      source_detail: input.source_detail ?? {},
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create deal: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "deal_created",
    company_id: data.company_id,
    contact_id: data.primary_contact_id,
    deal_id: data.id,
    description: `Deal "${data.title}" created at ${data.stage}`,
    actor_id: actorId ?? null,
    metadata: { value: data.value, source: input.source ?? "manual" },
  });

  return data as Deal;
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch deal: ${error.message}`);
  return (data as Deal) ?? null;
}

export async function getDealWithRelations(
  id: string,
): Promise<DealWithRelations | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deals")
    .select(
      `*,
       company:companies(id, name, industry, location, domain),
       primary_contact:contacts!deals_primary_contact_id_fkey(id, name, email, title),
       offering:offerings(id, slug, name)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const deal = data as DealWithRelations;
  const probability =
    deal.probability_override ?? defaultProbability(deal.stage);
  return {
    ...deal,
    probability,
    weighted_value: deal.value ? Math.round((deal.value * probability) / 100) : 0,
  };
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput,
  actorId?: string | null,
): Promise<Deal> {
  const sb = getSupabaseAdmin();
  const before = await getDeal(id);
  if (!before) throw new Error(`Deal ${id} not found`);

  const { data, error } = await sb
    .from("deals")
    .update({ ...input, last_activity_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update deal: ${error?.message}`);
  }

  if (input.value !== undefined && input.value !== before.value) {
    await logTimelineEvent({
      type: "deal_value_changed",
      company_id: data.company_id,
      deal_id: data.id,
      description: `Deal value changed from £${before.value ?? 0} to £${data.value ?? 0}`,
      actor_id: actorId ?? null,
      metadata: { from: before.value, to: data.value },
    });
  }

  return data as Deal;
}

export async function changeDealStage(
  id: string,
  stage: DealStage,
  actorId?: string | null,
): Promise<Deal> {
  const sb = getSupabaseAdmin();
  const before = await getDeal(id);
  if (!before) throw new Error(`Deal ${id} not found`);
  if (before.stage === stage) return before;

  const { data, error } = await sb
    .from("deals")
    .update({ stage, last_activity_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to change deal stage: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "deal_stage_changed",
    company_id: data.company_id,
    contact_id: data.primary_contact_id,
    deal_id: data.id,
    description: `Stage changed from ${before.stage} to ${stage}`,
    actor_id: actorId ?? null,
    metadata: { from: before.stage, to: stage },
  });

  return data as Deal;
}

export async function archiveDeal(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("deals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to archive deal: ${error.message}`);
}

export interface ListDealsOptions {
  stage?: DealStage;
  company_id?: string;
  owner_id?: string;
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listDeals(
  opts: ListDealsOptions = {},
): Promise<DealWithRelations[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("deals").select(
    `*,
     company:companies(id, name, industry, location, domain),
     primary_contact:contacts!deals_primary_contact_id_fkey(id, name, email, title),
     offering:offerings(id, slug, name)`,
  );

  if (opts.archived === true) {
    q = q.not("archived_at", "is", null);
  } else {
    q = q.is("archived_at", null);
  }

  if (opts.stage) q = q.eq("stage", opts.stage);
  if (opts.company_id) q = q.eq("company_id", opts.company_id);
  if (opts.owner_id) q = q.eq("owner_id", opts.owner_id);
  if (opts.search) {
    q = q.ilike("title", `%${opts.search}%`);
  }

  q = q.order("last_activity_at", { ascending: false, nullsFirst: false });

  if (opts.limit !== undefined) q = q.limit(opts.limit);
  if (opts.offset !== undefined) {
    q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Failed to list deals: ${error.message}`);

  return ((data ?? []) as DealWithRelations[]).map((d) => {
    const probability = d.probability_override ?? defaultProbability(d.stage);
    return {
      ...d,
      probability,
      weighted_value: d.value ? Math.round((d.value * probability) / 100) : 0,
    };
  });
}

export async function listDealsByStage(): Promise<
  Record<DealStage, DealWithRelations[]>
> {
  const all = await listDeals();
  const byStage: Record<DealStage, DealWithRelations[]> = {
    lead: [],
    qualified: [],
    discovery: [],
    proposal: [],
    negotiation: [],
    won: [],
    lost: [],
  };
  for (const d of all) {
    byStage[d.stage].push(d);
  }
  return byStage;
}

export async function getForecast(): Promise<DealForecast[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deal_forecast")
    .select("*")
    .order("close_month", { ascending: true, nullsFirst: false });
  if (error) {
    throw new Error(`Failed to fetch forecast: ${error.message}`);
  }
  return (data ?? []) as DealForecast[];
}
