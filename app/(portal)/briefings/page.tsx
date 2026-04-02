import { createClient } from "@/lib/supabase/server";
import { BriefingCard } from "@/components/briefing-card";
import type { Briefing, Lead } from "@/types";

export default async function BriefingsPage() {
  const supabase = await createClient();

  const { data: briefings } = await supabase
    .from("briefings")
    .select("*")
    .order("created_at", { ascending: false });

  const typedBriefings = (briefings || []) as Briefing[];

  // Fetch lead names for the briefing cards
  const leadIds = Array.from(new Set(typedBriefings.map((b) => b.lead_id)));
  let leadMap: Record<string, string> = {};

  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, company")
      .in("id", leadIds);

    leadMap = Object.fromEntries(
      ((leads || []) as Pick<Lead, "id" | "company">[]).map((l) => [
        l.id,
        l.company,
      ]),
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Briefings</h1>

      <div className="mt-6 space-y-3">
        {typedBriefings.length === 0 && (
          <p className="text-sm text-stone">
            No briefings generated yet. Briefings are created when a lead
            responds positively, or manually from the lead detail view.
          </p>
        )}
        {typedBriefings.map((briefing) => (
          <BriefingCard
            key={briefing.id}
            briefing={briefing}
            companyName={leadMap[briefing.lead_id]}
          />
        ))}
      </div>
    </div>
  );
}
