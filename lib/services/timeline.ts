import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { TimelineEvent, TimelineEventType } from "@/types";

export interface LogTimelineInput {
  type: TimelineEventType;
  company_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  actor_id?: string | null;
}

export async function logTimelineEvent(
  input: LogTimelineInput,
): Promise<TimelineEvent> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("timeline_events")
    .insert({
      type: input.type,
      company_id: input.company_id ?? null,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      description: input.description,
      metadata: input.metadata ?? {},
      actor_id: input.actor_id ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to log timeline event: ${error?.message}`);
  }

  // Bump deal.last_activity_at when an event is attached to a deal.
  if (input.deal_id) {
    await sb
      .from("deals")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", input.deal_id);
  }

  return data as TimelineEvent;
}

export interface ListTimelineOptions {
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  limit?: number;
}

export async function listTimelineEvents(
  opts: ListTimelineOptions,
): Promise<TimelineEvent[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("timeline_events").select("*");

  if (opts.company_id) q = q.eq("company_id", opts.company_id);
  if (opts.contact_id) q = q.eq("contact_id", opts.contact_id);
  if (opts.deal_id) q = q.eq("deal_id", opts.deal_id);

  q = q.order("created_at", { ascending: false }).limit(opts.limit ?? 100);

  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to list timeline events: ${error.message}`);
  }
  return (data ?? []) as TimelineEvent[];
}
