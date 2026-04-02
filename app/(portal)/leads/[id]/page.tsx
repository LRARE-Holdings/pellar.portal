import { createClient } from "@/lib/supabase/server";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { notFound } from "next/navigation";
import type { Lead, Email, Briefing, ActivityLogEntry } from "@/types";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [leadResult, emailsResult, briefingsResult, activityResult] =
    await Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase
        .from("emails")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("briefings")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!leadResult.data) {
    notFound();
  }

  return (
    <LeadDetailPanel
      lead={leadResult.data as Lead}
      emails={(emailsResult.data || []) as Email[]}
      briefings={(briefingsResult.data || []) as Briefing[]}
      activity={(activityResult.data || []) as ActivityLogEntry[]}
    />
  );
}
