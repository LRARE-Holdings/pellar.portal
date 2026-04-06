import type { EnrichedLead, ScoredLead, OfferingType } from "@/types";

export function scoreLead(lead: EnrichedLead): ScoredLead {
  let score = 0;

  // Email found (20 points)
  if (lead.contactEmail && lead.contactName !== "Unknown") {
    score += 20;
  } else if (lead.contactEmail) {
    score += 10;
  }

  // Website quality (15 points) — worse website = more pain = better lead
  if (!lead.website) {
    score += 12;
  } else if (lead.websiteLooksOutdated) {
    score += 15;
  } else {
    score += 3;
  }

  // Industry fit (15 points) — professional services focus
  const HIGH_FIT = [
    "Legal",
    "Accountancy",
    "Financial Advisory",
    "Estate Agency",
    "Insurance Broking",
  ];
  const MED_FIT = [
    "Architecture & Engineering",
    "Recruitment",
    "Management Consultancy",
    "Surveying",
  ];
  if (HIGH_FIT.includes(lead.industry)) {
    score += 15;
  } else if (MED_FIT.includes(lead.industry)) {
    score += 10;
  } else {
    score += 5;
  }

  // Location proximity (10 points)
  const CORE = ["Newcastle", "Gateshead"];
  const TYNE_WEAR = [
    "Sunderland",
    "North Shields",
    "South Shields",
    "Wallsend",
    "Whitley Bay",
  ];
  if (CORE.some((loc) => lead.location.includes(loc))) {
    score += 10;
  } else if (TYNE_WEAR.some((loc) => lead.location.includes(loc))) {
    score += 8;
  } else {
    score += 5;
  }

  // Company size signals (15 points)
  if (lead.estimatedEmployees) {
    if (lead.estimatedEmployees >= 10 && lead.estimatedEmployees <= 50) {
      score += 15;
    } else if (
      lead.estimatedEmployees >= 5 &&
      lead.estimatedEmployees <= 100
    ) {
      score += 10;
    } else {
      score += 3;
    }
  }

  // Frustration signals (15 points)
  score += lead.frustrationScore || 0;

  // Recency (10 points)
  score += lead.recencyScore || 0;

  return { ...lead, score: Math.min(score, 100) };
}

export function matchOffering(
  frustration: string,
  _industry: string,
): OfferingType {
  const lower = frustration.toLowerCase();

  if (
    [
      "disconnect",
      "multiple systems",
      "integrate",
      "connect",
      "different tools",
    ].some((w) => lower.includes(w))
  ) {
    return "integration";
  }
  if (
    ["manual", "repetitive", "spreadsheet", "chasing", "phone", "paper"].some(
      (w) => lower.includes(w),
    )
  ) {
    return "automation";
  }
  if (
    ["data", "predict", "document", "extract", "classify", "analysis"].some(
      (w) => lower.includes(w),
    )
  ) {
    return "ai";
  }

  return "software";
}
