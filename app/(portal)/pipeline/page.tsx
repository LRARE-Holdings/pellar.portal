import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline-board";
import type { Lead } from "@/types";

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("stale", false)
    .order("score", { ascending: false });

  const leads = (data || []) as Lead[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Pipeline</h1>
      <div className="mt-6">
        <PipelineBoard leads={leads} />
      </div>
    </div>
  );
}
