/**
 * Recalculate deal values for all leads using the updated
 * size-aware estimation logic.
 *
 * Run with: npx tsx scripts/recalculate-deal-values.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no dotenv dependency)
function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env.local");
  const contents = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

// Inline the estimation logic (can't import from @/ in scripts easily)

type OfferingType = "software" | "integration" | "ai" | "automation";
type SizeTier = "micro" | "small" | "medium" | "established";

const TIER_BASE_RANGE: Record<SizeTier, { min: number; max: number }> = {
  micro: { min: 1500, max: 4000 },
  small: { min: 4000, max: 10000 },
  medium: { min: 10000, max: 22000 },
  established: { min: 20000, max: 45000 },
};

const OFFERING_MULTIPLIER: Record<OfferingType, number> = {
  automation: 0.8,
  integration: 1.0,
  software: 1.15,
  ai: 1.25,
};

const INDUSTRY_ADJUSTMENT: Record<string, number> = {
  Manufacturing: 1.15,
  Healthcare: 1.15,
  Legal: 1.1,
  "Financial Services": 1.1,
  Construction: 1.0,
  Logistics: 1.05,
  Property: 1.0,
  Technology: 0.7,
  Hospitality: 0.85,
  "Professional Services": 0.95,
};

interface SizeSignals {
  employeeCount: number | null;
  directorCount: number;
  hasMultipleSites: boolean;
  hasWebsite: boolean;
  isPartOfLargerOrg: boolean;
  revenueHints: "low" | "mid" | "high" | null;
}

function extractSizeSignals(
  notes: string | null,
  frustration: string | null,
  website: string | null,
): SizeSignals {
  const text = `${notes || ""} ${frustration || ""}`.toLowerCase();

  let employeeCount: number | null = null;
  const staffPatterns = [
    /(\d+)\+?\s*(?:staff|employees|people|workers|team members)/,
    /(?:staff|employees|people|team)\s*(?:of\s+)?(?:around\s+|approximately\s+|about\s+)?(\d+)/,
    /(\d+)\+?\s*(?:vehicles|vans|trucks)/,
  ];
  for (const pattern of staffPatterns) {
    const match = text.match(pattern);
    if (match) {
      employeeCount = parseInt(match[1], 10);
      break;
    }
  }

  let directorCount = 0;
  const directorMatch = text.match(/(\d+)\s*(?:active\s+)?directors?/);
  if (directorMatch) {
    directorCount = parseInt(directorMatch[1], 10);
  } else {
    const directorNames = text.match(/director[s]?:\s*([^.]+)/i);
    if (directorNames) {
      directorCount = (directorNames[1].match(/,/g) || []).length + 1;
    } else {
      if (/single director|sole director|one director/.test(text)) {
        directorCount = 1;
      }
      const dirMentions = text.match(/directors?:/gi);
      if (dirMentions && directorCount === 0) {
        directorCount = 1;
      }
    }
  }

  const hasMultipleSites =
    /multiple\s+(?:locations?|offices?|branches|restaurants?|shops?|stores?|clinics?|premises)/i.test(text) ||
    /(?:offices|branches|locations|restaurants|shops)\s+(?:in|across)\s+\w+.*?,\s*\w+/i.test(text) ||
    /restaurants?\s+in\s+\w+.*?,\s*\w+/i.test(text);

  const isPartOfLargerOrg =
    /part of|subsidiary|division of|arm of|(?:group\s+(?:ltd|limited|plc|inc))|plc\b|holdings/i.test(text);

  let revenueHints: "low" | "mid" | "high" | null = null;
  if (
    /crown commercial|government supplier|ccs supplier|nhs supplier/i.test(text)
  ) {
    revenueHints = "high";
  } else if (isPartOfLargerOrg || hasMultipleSites) {
    revenueHints = "mid";
  } else if (
    /no website|single director|sole|micro|freelanc/i.test(text) &&
    !website
  ) {
    revenueHints = "low";
  }

  return {
    employeeCount,
    directorCount,
    hasMultipleSites,
    hasWebsite: !!website,
    isPartOfLargerOrg,
    revenueHints,
  };
}

function classifyTier(signals: SizeSignals): SizeTier {
  if (signals.employeeCount !== null) {
    if (signals.employeeCount >= 50) return "established";
    if (signals.employeeCount >= 15) return "medium";
    if (signals.employeeCount >= 5) return "small";
    return "micro";
  }

  if (signals.isPartOfLargerOrg) return "established";
  if (signals.hasMultipleSites) return "medium";

  if (signals.directorCount >= 5) return "medium";
  if (signals.directorCount >= 3) return "small";

  if (signals.revenueHints === "high") return "established";
  if (signals.revenueHints === "mid") return "medium";
  if (signals.revenueHints === "low") return "micro";

  if (signals.directorCount <= 1 && !signals.hasWebsite) return "micro";
  if (signals.directorCount <= 1) return "small";

  return "small";
}

function estimateDealValue(
  offering: OfferingType | null,
  industry: string,
  score: number,
  notes: string | null,
  frustration: string | null,
  website: string | null,
): number {
  const signals = extractSizeSignals(notes, frustration, website);
  const tier = classifyTier(signals);
  const range = TIER_BASE_RANGE[tier];

  const scorePosition = Math.max(0, Math.min(1, (score - 30) / 60));
  const baseMidpoint = range.min + (range.max - range.min) * scorePosition;

  const offeringMul = OFFERING_MULTIPLIER[(offering as OfferingType) || "software"];
  const industryMul = INDUSTRY_ADJUSTMENT[industry] || 1.0;

  const raw = baseMidpoint * offeringMul * industryMul;
  return Math.round(raw / 500) * 500;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, company, offering, industry, score, deal_value, notes, frustration, website")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch leads:", error.message);
    process.exit(1);
  }

  console.log(`Found ${leads.length} leads to recalculate\n`);
  console.log("Company".padEnd(45), "Old".padStart(8), "New".padStart(8), "Tier".padStart(14));
  console.log("-".repeat(80));

  let updated = 0;

  for (const lead of leads) {
    const signals = extractSizeSignals(lead.notes, lead.frustration, lead.website);
    const tier = classifyTier(signals);
    const newValue = estimateDealValue(
      lead.offering,
      lead.industry,
      lead.score,
      lead.notes,
      lead.frustration,
      lead.website,
    );

    const oldStr = lead.deal_value != null ? `${lead.deal_value.toLocaleString()}` : "—";
    const newStr = `${newValue.toLocaleString()}`;
    const changed = lead.deal_value !== newValue;

    console.log(
      lead.company.padEnd(45),
      oldStr.padStart(8),
      newStr.padStart(8),
      tier.padStart(14),
      changed ? " *" : "",
    );

    if (changed) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ deal_value: newValue })
        .eq("id", lead.id);

      if (updateError) {
        console.error(`  Failed to update ${lead.company}:`, updateError.message);
      } else {
        updated++;
      }
    }
  }

  console.log(`\nDone. Updated ${updated} of ${leads.length} leads.`);
}

main();
