import { supabaseAdmin } from "@/lib/supabase/admin";
import * as companiesHouse from "@/lib/clients/companies-house";
import * as hunter from "@/lib/clients/hunter";
import { enrichLead } from "@/lib/services/enrichment";
import { scoreLead } from "@/lib/services/scoring";
import { estimateDealValue } from "@/lib/services/deal-value";
import type {
  CompanyCandidate,
  EnrichedLead,
  Lead,
  DiscoveryResult,
  ScoredLead,
} from "@/types";

const HUNTER_SCORE_THRESHOLD = 70;

const SECTOR_SCHEDULE: Record<number, string[]> = {
  1: ["Manufacturing", "Construction"],
  2: ["Legal", "Financial Services"],
  3: ["Healthcare", "Professional Services"],
  4: ["Property", "Hospitality"],
  5: ["Logistics", "Retail", "Technology"],
};

const SECTOR_SIC_CODES: Record<string, string[]> = {
  Manufacturing: [
    "10", "11", "13", "14", "15", "16", "17", "18", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
  ],
  Legal: ["69"],
  "Financial Services": ["64", "65", "66"],
  Healthcare: ["86", "87", "88"],
  Property: ["68"],
  Construction: ["41", "42", "43"],
  Hospitality: ["55", "56"],
  Logistics: ["49", "50", "51", "52", "53"],
  "Professional Services": ["70", "71", "73", "74"],
  Education: ["85"],
  Retail: ["47"],
  Technology: ["62", "63"],
};

function getTodaysSectors(): string[] {
  const day = new Date().getDay();
  return SECTOR_SCHEDULE[day] || [];
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const sectors = getTodaysSectors();
  if (sectors.length === 0) {
    return { discovered: 0, leads: [], skipped: 0, errors: [] };
  }

  const errors: string[] = [];

  // 1. Query Companies House for each sector
  const candidates: CompanyCandidate[] = [];
  for (const sector of sectors) {
    const sicCodes = SECTOR_SIC_CODES[sector];
    if (!sicCodes) continue;

    for (const postcodeArea of ["NE", "DH", "SR", "TS", "DL"]) {
      try {
        const results = await companiesHouse.search({
          sicCodes,
          postcodeArea,
          status: "active",
          incorporatedAfter: "2015-01-01",
        });
        candidates.push(
          ...results.map((r) => ({ ...r, industry: sector })),
        );
      } catch (err) {
        errors.push(
          `Companies House search failed for ${sector}/${postcodeArea}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }
  }

  // 2. Dedup against existing leads
  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("company, location");

  const existingSet = new Set(
    (existing || []).map(
      (l: { company: string; location: string }) =>
        `${l.company.toLowerCase()}|${l.location.toLowerCase()}`,
    ),
  );

  const fresh = candidates.filter(
    (c) =>
      !existingSet.has(`${c.name.toLowerCase()}|${c.location.toLowerCase()}`),
  );

  // 3. Enrich candidates (process more than 10 to allow filtering)
  const enriched: EnrichedLead[] = [];
  for (const candidate of fresh.slice(0, 30)) {
    try {
      const lead = await enrichLead(candidate);
      if (lead) enriched.push(lead);
    } catch (err) {
      errors.push(
        `Enrichment failed for ${candidate.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  // 4. Score and rank
  const scored = enriched.map(scoreLead).sort((a, b) => b.score - a.score);

  // 5. Take top 10
  const topLeads = scored.slice(0, 10);

  // 6. Hunter email lookup for high-scoring leads without a verified email
  for (const lead of topLeads) {
    if (lead.contactEmail) continue; // Already have an email
    if (lead.score < HUNTER_SCORE_THRESHOLD) continue;
    if (!lead.website || lead.contactName === "Unknown") continue;

    try {
      const domain = new URL(
        lead.website.startsWith("http") ? lead.website : `https://${lead.website}`,
      ).hostname.replace(/^www\./, "");

      const nameParts = lead.contactName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      if (!firstName || !lastName) continue;

      const result = await hunter.findEmail({ domain, firstName, lastName });
      if (result && result.score >= 70) {
        lead.contactEmail = result.email;
        // Re-score since having an email adds 20 points
        const rescored = scoreLead(lead as EnrichedLead);
        (lead as ScoredLead).score = rescored.score;
      }
    } catch (err) {
      errors.push(
        `Hunter lookup failed for ${lead.company}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  // 7. Insert into Supabase
  const inserted: Lead[] = [];
  for (const lead of topLeads) {
    const { data } = await supabaseAdmin
      .from("leads")
      .insert({
        company: lead.company,
        contact_name: lead.contactName,
        contact_email: lead.contactEmail,
        industry: lead.industry,
        location: lead.location,
        website: lead.website,
        stage: "identified",
        score: lead.score,
        offering: lead.offering,
        frustration: lead.frustration,
        notes: lead.notes,
        source: lead.source,
        deal_value: estimateDealValue(lead.offering, lead.industry, lead.score, lead.notes, lead.frustration, lead.website),
      })
      .select()
      .single();

    if (data) {
      await supabaseAdmin.from("activity_log").insert({
        lead_id: data.id,
        type: "lead_created",
        description: `Discovered ${data.company} via ${lead.source}`,
      });
      inserted.push(data as Lead);
    }
  }

  return {
    discovered: inserted.length,
    leads: inserted,
    skipped: fresh.length - enriched.length,
    errors,
  };
}
