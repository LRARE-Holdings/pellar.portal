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
const TARGET_LEADS = 50;
const CANDIDATES_TARGET = 1000;
const QUALIFICATION_THRESHOLD = 50;
const ENRICHMENT_BATCH_SIZE = 3;

// Professional services focus — firms that buy operational software,
// not regulated products. Lawyers, accountants, financial advisors,
// estate agents, architects, consultancies, recruiters.
const TARGET_SECTORS = [
  "Legal",
  "Accountancy",
  "Financial Advisory",
  "Estate Agency",
  "Architecture & Engineering",
  "Recruitment",
  "Management Consultancy",
  "Surveying",
  "Insurance Broking",
];

// Full 5-digit SIC codes for the Companies House sic_codes query parameter.
const SECTOR_SIC_CODES: Record<string, string[]> = {
  Legal: ["69101", "69102", "69109"],
  Accountancy: ["69201", "69202", "69203"],
  "Financial Advisory": ["66190", "66120", "66220"],
  "Estate Agency": ["68310", "68320"],
  "Architecture & Engineering": ["71111", "71121", "71122", "71200"],
  Recruitment: ["78100", "78200", "78300"],
  "Management Consultancy": ["70210", "70221", "70229"],
  Surveying: ["71122"],
  "Insurance Broking": ["66220"],
};

// National coverage: major UK cities and regions.
// NE England listed first (priority), then national.
const UK_LOCATIONS: Array<{ query: string; postcodePrefix: string }> = [
  // NE England (priority)
  { query: "Newcastle upon Tyne", postcodePrefix: "NE" },
  { query: "Durham", postcodePrefix: "DH" },
  { query: "Sunderland", postcodePrefix: "SR" },
  { query: "Middlesbrough", postcodePrefix: "TS" },
  { query: "Darlington", postcodePrefix: "DL" },
  // Yorkshire
  { query: "Leeds", postcodePrefix: "LS" },
  { query: "Sheffield", postcodePrefix: "S" },
  { query: "York", postcodePrefix: "YO" },
  // North West
  { query: "Manchester", postcodePrefix: "M" },
  { query: "Liverpool", postcodePrefix: "L" },
  // Midlands
  { query: "Birmingham", postcodePrefix: "B" },
  { query: "Nottingham", postcodePrefix: "NG" },
  { query: "Leicester", postcodePrefix: "LE" },
  // South
  { query: "Bristol", postcodePrefix: "BS" },
  { query: "Oxford", postcodePrefix: "OX" },
  { query: "Cambridge", postcodePrefix: "CB" },
  { query: "Reading", postcodePrefix: "RG" },
  // London
  { query: "London", postcodePrefix: "EC" },
  { query: "London", postcodePrefix: "WC" },
  // Scotland
  { query: "Edinburgh", postcodePrefix: "EH" },
  { query: "Glasgow", postcodePrefix: "G" },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phase 1: Fast national search — gather 1000+ raw candidates from
 * Companies House. No enrichment at this stage (just CH data).
 */
async function searchNationally(
  errors: string[],
): Promise<CompanyCandidate[]> {
  const candidates: CompanyCandidate[] = [];
  const seen = new Set<string>();

  for (const sector of TARGET_SECTORS) {
    const sicCodes = SECTOR_SIC_CODES[sector];
    if (!sicCodes) continue;

    for (const loc of UK_LOCATIONS) {
      if (candidates.length >= CANDIDATES_TARGET) break;

      try {
        const results = await companiesHouse.search({
          sicCodes,
          postcodeArea: loc.postcodePrefix,
          locationQuery: loc.query,
          status: "active",
          incorporatedAfter: "2010-01-01",
          maxResults: 200,
        });

        for (const r of results) {
          if (seen.has(r.companyNumber)) continue;
          seen.add(r.companyNumber);
          candidates.push({ ...r, industry: sector });
        }
      } catch (err) {
        errors.push(
          `CH search failed for ${sector}/${loc.query}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    await delay(200);
    if (candidates.length >= CANDIDATES_TARGET) break;
  }

  return candidates;
}

/**
 * Phase 2: Enrich candidates in batches of ENRICHMENT_BATCH_SIZE,
 * with delays to respect API rate limits.
 */
async function enrichBatch(
  candidates: CompanyCandidate[],
  errors: string[],
): Promise<EnrichedLead[]> {
  const enriched: EnrichedLead[] = [];

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

    if (i + ENRICHMENT_BATCH_SIZE < candidates.length) {
      await delay(2000);
    }
  }

  return enriched;
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const errors: string[] = [];

  // 1. Search nationally for 1000+ raw candidates
  const candidates = await searchNationally(errors);

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

  // 3. Pre-score using basic signals (industry + location) to select
  //    the best candidates for full enrichment. This avoids wasting
  //    expensive API calls on leads we won't use.
  const HIGH_FIT_SECTORS = new Set([
    "Legal", "Accountancy", "Financial Advisory",
    "Estate Agency", "Insurance Broking",
  ]);
  const NE_PREFIXES = new Set(["NE", "DH", "SR", "TS", "DL"]);

  const preScored = fresh.map((c) => {
    let preScore = 0;
    if (HIGH_FIT_SECTORS.has(c.industry)) preScore += 15;
    else preScore += 10;

    const postPrefix = c.location.match(/([A-Z]{1,2})\d/)?.[1] || "";
    if (NE_PREFIXES.has(postPrefix)) preScore += 10;
    else preScore += 5;

    // Prefer established firms (incorporated earlier)
    const age = new Date().getFullYear() - new Date(c.incorporatedDate).getFullYear();
    if (age >= 5 && age <= 30) preScore += 5;
    else if (age >= 2) preScore += 2;

    return { candidate: c, preScore };
  });

  preScored.sort((a, b) => b.preScore - a.preScore);

  // Take top 150 for enrichment (to get at least 50 qualified after full scoring)
  const topCandidates = preScored.slice(0, 150).map((p) => p.candidate);

  // 4. Enrich the top candidates
  const enriched = await enrichBatch(topCandidates, errors);

  // 5. Full score and rank
  const scored = enriched.map(scoreLead).sort((a, b) => b.score - a.score);

  // 6. Filter: score threshold + must have email + phone
  const qualified = scored.filter(
    (s) =>
      s.score >= QUALIFICATION_THRESHOLD &&
      s.contactEmail &&
      s.phone,
  );
  const topLeads = qualified.slice(0, TARGET_LEADS);

  // 7. Hunter email lookup for high-scoring leads without verified email
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
