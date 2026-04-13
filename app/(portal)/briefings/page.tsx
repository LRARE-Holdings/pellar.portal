import { createClient } from "@/lib/supabase/server";
import { BriefingCard } from "@/components/briefing-card";
import type { Briefing } from "@/types";

export default async function BriefingsPage() {
  const supabase = await createClient();

  // Fetch briefings with company relation (new schema)
  const { data: briefings } = await supabase
    .from("briefings")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });

  const typedBriefings = (briefings || []) as (Briefing & {
    company?: { id: string; name: string } | null;
  })[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Briefings</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2 3xl:grid-cols-3">
        {typedBriefings.length === 0 && (
          <p className="text-sm text-stone">
            No briefings generated yet. Briefings are created when a lead
            responds positively, or manually from the deal detail view.
          </p>
        )}
        {typedBriefings.map((briefing) => (
          <BriefingCard
            key={briefing.id}
            briefing={briefing}
            companyName={briefing.company?.name}
          />
        ))}
      </div>
    </div>
  );
}
