import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline-board";
import { StatCard } from "@/components/stat-card";
import type { Lead, PipelineValue } from "@/types";

function formatGBP(value: number): string {
  if (value === 0) return "GBP 0";
  return `GBP ${value.toLocaleString("en-GB")}`;
}

export default async function PipelinePage() {
  const supabase = await createClient();

  const [leadsResult, pipelineResult] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("stale", false)
      .order("score", { ascending: false }),
    supabase.from("pipeline_value").select("*"),
  ]);

  const leads = (leadsResult.data || []) as Lead[];
  const pipelineValues = (pipelineResult.data || []) as PipelineValue[];

  const stageValues: Record<string, number> = {};
  let totalPipeline = 0;
  let totalLeadCount = 0;
  pipelineValues.forEach((pv) => {
    stageValues[pv.stage] = pv.total_value;
    totalPipeline += pv.total_value;
    totalLeadCount += pv.lead_count;
  });

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Pipeline</h1>

      <div className="mt-5 grid grid-cols-3 gap-3 xl:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeadCount} />
        <StatCard label="Pipeline Value" value={formatGBP(totalPipeline)} />
        <StatCard
          label="Won Value"
          value={formatGBP(stageValues["won"] || 0)}
        />
        <StatCard
          label="Avg Deal"
          value={formatGBP(
            totalLeadCount > 0
              ? Math.round(totalPipeline / totalLeadCount)
              : 0,
          )}
        />
      </div>

      <div className="mt-6">
        <PipelineBoard leads={leads} stageValues={stageValues} />
      </div>
    </div>
  );
}
