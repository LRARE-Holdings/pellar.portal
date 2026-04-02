import { createClient } from "@/lib/supabase/server";
import { LeadTable } from "@/components/lead-table";
import type { Lead } from "@/types";

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("last_activity", { ascending: false });

  const leads = (data || []) as Lead[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Leads</h1>
      <div className="mt-6">
        <LeadTable leads={leads} />
      </div>
    </div>
  );
}
