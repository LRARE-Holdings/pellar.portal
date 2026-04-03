import type { OfferingType } from "@/types";

const BASE_VALUES: Record<OfferingType, number> = {
  software: 25000,
  integration: 18000,
  ai: 35000,
  automation: 12000,
};

const INDUSTRY_MULTIPLIERS: Record<string, number> = {
  Manufacturing: 1.3,
  Healthcare: 1.3,
  Legal: 1.2,
  "Financial Services": 1.2,
  Construction: 1.1,
  Property: 1.1,
};

function scoreMultiplier(score: number): number {
  if (score >= 80) return 1.3;
  if (score >= 60) return 1.1;
  if (score >= 40) return 1.0;
  return 0.8;
}

export function estimateDealValue(
  offering: OfferingType | null,
  industry: string,
  score: number,
): number {
  const base = BASE_VALUES[offering || "software"];
  const industryMul = INDUSTRY_MULTIPLIERS[industry] || 1.0;
  const scoreMul = scoreMultiplier(score);

  const raw = base * industryMul * scoreMul;
  return Math.round(raw / 500) * 500;
}
