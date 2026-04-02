"use client";

import { Button } from "@/components/ui/button";
import type {
  WeeklyTrend,
  FunnelStage,
  IndustryBreakdown,
  OfferingBreakdown,
} from "@/types";

interface ExportButtonsProps {
  trends: WeeklyTrend[];
  funnel: FunnelStage[];
  industries: IndustryBreakdown[];
  offerings: OfferingBreakdown[];
}

export function AnalyticsExportButtons({
  trends,
  funnel,
  industries,
  offerings,
}: ExportButtonsProps) {
  function downloadCSV() {
    const sections: string[] = [];

    sections.push("WEEKLY TRENDS");
    sections.push(
      "Week,Leads Discovered,Emails Sent,Follow-ups Sent,Responses Received,Response Rate,Briefings Generated",
    );
    trends.forEach((t) => {
      sections.push(
        `${t.week_label},${t.leads_discovered},${t.emails_sent},${t.followups_sent},${t.responses_received},${t.response_rate}%,${t.briefings_generated}`,
      );
    });

    sections.push("");
    sections.push("CONVERSION FUNNEL");
    sections.push("Stage,Lead Count,Percentage");
    funnel.forEach((f) => {
      sections.push(`${f.stage},${f.lead_count},${f.pct_of_total}%`);
    });

    sections.push("");
    sections.push("INDUSTRY BREAKDOWN");
    sections.push(
      "Industry,Total Leads,Contacted,Responded,Won,Response Rate,Avg Score",
    );
    industries.forEach((i) => {
      sections.push(
        `${i.industry},${i.total_leads},${i.contacted},${i.responded},${i.won},${i.response_rate}%,${i.avg_score}`,
      );
    });

    sections.push("");
    sections.push("OFFERING BREAKDOWN");
    sections.push(
      "Offering,Total Leads,Contacted,Responded,Won,Response Rate",
    );
    offerings.forEach((o) => {
      sections.push(
        `${o.offering},${o.total_leads},${o.contacted},${o.responded},${o.won},${o.response_rate}%`,
      );
    });

    const csv = sections.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pellar-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={downloadCSV}>
        Export CSV
      </Button>
      <Button size="sm" onClick={handlePrint}>
        Print / Save PDF
      </Button>
    </div>
  );
}
