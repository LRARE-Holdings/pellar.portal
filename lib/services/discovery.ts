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
const TARGET_LEADS = 100;
const ENRICHMENT_POOL_SIZE = 250;
const QUALIFICATION_THRESHOLD = 50;
const ENRICHMENT_BATCH_SIZE = 10;

// Run all sectors every day — no day-of-week rotation
const ALL_SECTORS = [
  "Manufacturing",
  "Construction",
  "Legal",
  "Financial Services",
  "Healthcare",
  "Professional Services",
  "Property",
  "Hospitality",
  "Logistics",
  "Retail",
  "Technology",
];

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

// Map postcode areas to place names for the Companies House location search.
// The API does free-text matching on addresses so "NE" alone matches
// "Ne Lincolnshire", "Newbury" etc. Using the city/town name gets far
// better precision (100% vs 12% correct postcode matches).
const NE_LOCATIONS: Array<{ query: string; postcodePrefix: string }> = [
  { query: "Newcastle upon Tyne", postcodePrefix: "NE" },
  { query: "Durham", postcodePrefix: "DH" },
  { query: "Sunderland", postcodePrefix: "SR" },
  { query: "Middlesbrough", postcodePrefix: "TS" },
  { query: "Darlington", postcodePrefix: "DL" },
];
const WIDER_LOCATIONS: Array<{ query: string; postcodePrefix: string }> = [
  { query: "York", postcodePrefix: "YO" },
  { query: "Harrogate", postcodePrefix: "HG" },
  { query: "Carlisle", postcodePrefix: "CA" },
  { query: "Lancaster", postcodePrefix: "LA" },
];
const MIN_CANDIDATES_BEFORE_EXPANSION = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchAllSectors(
  locations: Array<{ query: string; postcodePrefix: string }>,
  errors: string[],
): Promise<CompanyCandidate[]> {
  const candidates: CompanyCandidate[] = [];

  for (const sector of ALL_SECTORS) {
    const sicCodes = SECTOR_SIC_CODES[sector];
    if (!sicCodes) continue;

    for (const loc of locations) {
      try {
        const results = await companiesHouse.search({
          sicCodes,
          postcodeArea: loc.postcodePrefix,
          locationQuery: loc.query,
          status: "active",
          incorporatedAfter: "2015-01-01",
          maxResults: 500,
        });
        candidates.push(
          ...results.map((r) => ({ ...r, industry: sector })),
        );
      } catch (err) {
        errors.push(
          `Companies House search failed for ${sector}/${loc.query}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    // Rate limiting between sector batches
    await delay(200);
  }

  return candidates;
}

async function enrichBatch(
  candidates: CompanyCandidate[],
  errors: string[],
): Promise<EnrichedLead[]> {
  const enriched: EnrichedLead[] = [];

  // Process in batches for parallelism
  for (let i = 0; i < candidates.length; i += ENRICHMENT_BATCH_SIZE) {
    const batch = candidates.slice(i, i + ENRICHMENT_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((candidate) => enrichLead(candidate)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        enriched.push(result.value);
      } else if (result.status === "rejected") {
        errors.push(
          `Enrichment failed for ${batch[j].name}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`,
        );
      }
    }

    // Brief pause between batches to respect API limits
    if (i + ENRICHMENT_BATCH_SIZE < candidates.length) {
      await delay(100);
    }
  }

  return enriched;
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const errors: string[] = [];

  // 1. Search Companies House across all sectors, NE locations first
  let candidates = await searchAllSectors(NE_LOCATIONS, errors);

  // 2. Expand to wider geography if NE is thin
  if (candidates.length < MIN_CANDIDATES_BEFORE_EXPANSION) {
    const widerCandidates = await searchAllSectors(WIDER_LOCATIONS, errors);
    candidates = [...candidates, ...widerCandidates];
  }

  // 3. Dedup against existing leads
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

  // 4. Enrich candidates in parallel batches
  const toEnrich = fresh.slice(0, ENRICHMENT_POOL_SIZE);
  const enriched = await enrichBatch(toEnrich, errors);

  // 5. Score and rank
  const scored = enriched.map(scoreLead).sort((a, b) => b.score - a.score);

  // 6. Filter by qualification threshold and take top TARGET_LEADS
  const qualified = scored.filter((s) => s.score >= QUALIFICATION_THRESHOLD);
  const topLeads = qualified.slice(0, TARGET_LEADS);

  // 7. Hunter email lookup for high-scoring leads without a verified email
  for (const lead of topLeads) {
    if (lead.contactEmail) continue;
    if (lead.score < HUNTER_SCORE_THRESHOLD) continue;
    if (!lead.website || lead.contactName === "Unknown") continue;

    try {
      const domain = new URL(
        lead.website.startsWith("http")
          ? lead.website
          : `https://${lead.website}`,
      ).hostname.replace(/^www\./, "");

      const nameParts = lead.contactName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      if (!firstName || !lastName) continue;

      const result = await hunter.findEmail({ domain, firstName, lastName });
      if (result && result.score >= 70) {
        lead.contactEmail = result.email;
        const rescored = scoreLead(lead as EnrichedLead);
        (lead as ScoredLead).score = rescored.score;
      }
    } catch (err) {
      errors.push(
        `Hunter lookup failed for ${lead.company}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  // 8. Insert into Supabase
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
        deal_value: estimateDealValue(
          lead.offering,
          lead.industry,
          lead.score,
          lead.notes,
          lead.frustration,
          lead.website,
        ),
        phone: lead.phone,
        linkedin_url: lead.linkedinUrl,
        social_links: lead.socialLinks,
        google_rating: lead.googleRating,
        google_reviews: lead.googleReviews,
        estimated_revenue: lead.estimatedRevenue,
        estimated_employees: lead.estimatedEmployees,
        company_age_years: lead.companyAgeYears,
        company_number: lead.companyNumber,
      })
      .select()
      .single();

    if (data) {
      await supabaseAdmin.from("activity_log").insert({
        lead_id: data.id,
        type: "lead_created",
        description: `Discovered ${data.company} via ${lead.source} (score: ${lead.score})`,
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
