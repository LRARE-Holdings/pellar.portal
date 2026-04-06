import * as companiesHouse from "@/lib/clients/companies-house";
import * as googlePlaces from "@/lib/clients/google-places";
import { anthropic } from "@/lib/anthropic";
import { frustrationHypothesisPrompt } from "@/lib/prompts/enrichment";
import { matchOffering } from "@/lib/services/scoring";
import type { CompanyCandidate, EnrichedLead } from "@/types";
import { resolve } from "dns/promises";

const PREFERRED_ROLES = [
  "director",
  "managing director",
  "operations director",
  "practice manager",
  "founder",
  "chief executive",
  "ceo",
  "managing partner",
  "general manager",
];

interface OfficerResult {
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
}

function pickBestContact(officers: OfficerResult[]): OfficerResult | null {
  if (officers.length === 0) return null;

  for (const preferred of PREFERRED_ROLES) {
    const match = officers.find((o) =>
      o.role.toLowerCase().includes(preferred),
    );
    if (match) return match;
  }

  return officers[0];
}

function extractDomain(website: string): string | null {
  try {
    const url = new URL(
      website.startsWith("http") ? website : `https://${website}`,
    );
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function generateEmailCandidates(
  firstName: string,
  lastName: string,
  domain: string,
): string[] {
  const f = firstName.toLowerCase().trim();
  const l = lastName.toLowerCase().trim();
  if (!f || !l) return [`hello@${domain}`, `info@${domain}`];
  return [
    `${f}@${domain}`,
    `${f}.${l}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `hello@${domain}`,
    `info@${domain}`,
  ];
}

async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolve(domain, "MX");
    return records.length > 0;
  } catch {
    return false;
  }
}

async function verifyBestEmail(
  candidates: string[],
): Promise<string | null> {
  const domain = candidates[0].split("@")[1];
  const hasMx = await checkMxRecord(domain);
  if (hasMx) {
    return candidates[0];
  }
  return null;
}

interface WebsiteData {
  text: string;
  html: string;
}

async function extractWebsiteData(
  website: string,
): Promise<WebsiteData | null> {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PellarBot/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    return { text: text || "", html: html.slice(0, 50000) };
  } catch {
    return null;
  }
}

function detectOutdatedWebsite(html: string): boolean {
  const lower = html.toLowerCase();

  // Check copyright year
  const copyrightMatch = lower.match(
    /(?:©|\bcopyright\b)\s*(\d{4})/i,
  );
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1], 10);
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 2) return true;
  }

  // Check for old tech stack signals
  const outdatedSignals = [
    "jquery-1.",
    "jquery-2.",
    "bootstrap/3.",
    "bootstrap/2.",
    'name="generator" content="wordpress 4',
    'name="generator" content="wordpress 3',
    'name="generator" content="joomla',
    'name="generator" content="drupal 7',
    "wix.com/dfn/",
    "under construction",
    "coming soon",
  ];

  return outdatedSignals.some((signal) => lower.includes(signal));
}

function extractSocialLinks(html: string): Record<string, string> {
  const links: Record<string, string> = {};

  const patterns: [string, RegExp][] = [
    ["linkedin", /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+\/?/gi],
    ["twitter", /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/gi],
    ["facebook", /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+\/?/gi],
    ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+\/?/gi],
  ];

  for (const [name, pattern] of patterns) {
    const match = html.match(pattern);
    if (match && match[0]) {
      links[name] = match[0];
    }
  }

  return links;
}

function extractLinkedInUrl(html: string): string | null {
  const match = html.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/i,
  );
  return match ? match[0] : null;
}

const UK_PHONE_PATTERN =
  /(?:(?:\+44|0044)\s?|0)(?:\d[\s.-]?){9,10}\d/g;

function extractPhoneFromWebsite(text: string): string | null {
  const matches = text.match(UK_PHONE_PATTERN);
  if (!matches || matches.length === 0) return null;
  // Return first match, cleaned up
  return matches[0].replace(/[\s.-]/g, "");
}

function calculateRecencyScore(latestFilingDate: string | null): number {
  if (!latestFilingDate) return 2;

  const filingDate = new Date(latestFilingDate);
  const now = new Date();
  const monthsAgo =
    (now.getFullYear() - filingDate.getFullYear()) * 12 +
    (now.getMonth() - filingDate.getMonth());

  if (monthsAgo <= 6) return 10;
  if (monthsAgo <= 12) return 7;
  if (monthsAgo <= 24) return 4;
  return 1;
}

function calculateCompanyAge(incorporatedDate: string): number | null {
  try {
    const inc = new Date(incorporatedDate);
    const now = new Date();
    return Math.floor(
      (now.getTime() - inc.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
  } catch {
    return null;
  }
}

interface FrustrationResult {
  frustration: string;
  score: number;
}

async function generateFrustration(vars: {
  company: string;
  industry: string;
  location: string;
  websiteInfo: string | null;
  officers: string | null;
  filingCategory: string | null;
  companyAgeYears: number | null;
}): Promise<FrustrationResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: frustrationHypothesisPrompt({
            company: vars.company,
            industry: vars.industry,
            location: vars.location,
            website_info: vars.websiteInfo,
            officers: vars.officers,
            filing_category: vars.filingCategory,
            company_age_years: vars.companyAgeYears,
          }),
        },
      ],
    });

    const block = message.content[0];
    if (block.type === "text") {
      try {
        const parsed = JSON.parse(block.text.trim()) as {
          frustration?: string;
          score?: number;
        };
        return {
          frustration:
            parsed.frustration ||
            "Unable to determine specific frustration for this business.",
          score: Math.min(15, Math.max(0, parsed.score || 0)),
        };
      } catch {
        // If JSON parsing fails, treat the whole response as the frustration text
        return { frustration: block.text.trim(), score: 5 };
      }
    }
    return {
      frustration:
        "Unable to determine specific frustration for this business.",
      score: 0,
    };
  } catch {
    return {
      frustration:
        "Unable to determine specific frustration for this business.",
      score: 0,
    };
  }
}

function buildNotes(
  candidate: CompanyCandidate,
  websiteText: string | null,
  officers: OfficerResult[],
  filingCategory: string | null,
): string {
  const parts: string[] = [];
  parts.push(`Company number: ${candidate.companyNumber}`);
  parts.push(`SIC codes: ${candidate.sicCodes.join(", ")}`);
  parts.push(`Incorporated: ${candidate.incorporatedDate}`);
  if (filingCategory) {
    parts.push(`Accounts category: ${filingCategory}`);
  }
  if (officers.length > 0) {
    parts.push(
      `Officers: ${officers.map((o) => `${o.fullName} (${o.role})`).join("; ")}`,
    );
  }
  if (websiteText) {
    parts.push(`Website snippet: ${websiteText.slice(0, 300)}`);
  }
  return parts.join("\n");
}

export async function enrichLead(
  candidate: CompanyCandidate,
): Promise<EnrichedLead | null> {
  try {
    // 1. Google Places lookup for website, phone, rating
    const place = await googlePlaces.findBusiness({
      query: `${candidate.name} ${candidate.location}`,
      region: "uk",
    });

    const website = place?.website || null;
    const googlePhone = place?.phone || null;
    const googleRating = place?.rating || null;
    const googleReviews = place?.reviewCount || null;

    // 2. Website data extraction
    let websiteData: WebsiteData | null = null;
    if (website) {
      websiteData = await extractWebsiteData(website);
    }

    // 3. Detect outdated website
    const websiteLooksOutdated = websiteData
      ? detectOutdatedWebsite(websiteData.html)
      : false;

    // 4. Extract social links and LinkedIn from website HTML
    const socialLinks = websiteData
      ? extractSocialLinks(websiteData.html)
      : {};
    const linkedinUrl = websiteData
      ? extractLinkedInUrl(websiteData.html)
      : null;

    // 5. Extract phone from website if Google Places didn't have one
    const websitePhone = websiteData
      ? extractPhoneFromWebsite(websiteData.text)
      : null;
    const phone = googlePhone || websitePhone;

    // 6. Contact person from Companies House officers
    const officers = await companiesHouse.getOfficers(
      candidate.companyNumber,
    );
    const contact = pickBestContact(officers);

    // 7. Filing history for employee/revenue estimation
    const filingInsights = await companiesHouse.getFilingHistory(
      candidate.companyNumber,
    );

    // 8. Email construction
    let email: string | null = null;
    const domain = website ? extractDomain(website) : null;
    if (domain && contact) {
      const emailCandidates = generateEmailCandidates(
        contact.firstName,
        contact.lastName,
        domain,
      );
      email = await verifyBestEmail(emailCandidates);
    }

    // 9. Company age
    const companyAgeYears = calculateCompanyAge(candidate.incorporatedDate);

    // 10. Recency score from filing history
    const recencyScore = calculateRecencyScore(
      filingInsights.latestFilingDate,
    );

    // 11. Frustration hypothesis + score via Claude
    const officersSummary =
      officers.length > 0
        ? officers
            .slice(0, 3)
            .map((o) => `${o.fullName} (${o.role})`)
            .join(", ")
        : null;

    const frustrationResult = await generateFrustration({
      company: candidate.name,
      industry: candidate.industry,
      location: candidate.location,
      websiteInfo: websiteData?.text || null,
      officers: officersSummary,
      filingCategory: filingInsights.accountsCategory,
      companyAgeYears,
    });

    // 12. Match offering
    const offering = matchOffering(
      frustrationResult.frustration,
      candidate.industry,
    );

    return {
      company: candidate.name,
      contactName: contact?.fullName || "Unknown",
      contactEmail: email,
      industry: candidate.industry,
      location: candidate.location,
      website,
      frustration: frustrationResult.frustration,
      offering,
      source: candidate.source,
      notes: buildNotes(
        candidate,
        websiteData?.text || null,
        officers,
        filingInsights.accountsCategory,
      ),
      websiteLooksOutdated,
      estimatedEmployees: filingInsights.estimatedEmployees,
      frustrationScore: frustrationResult.score,
      recencyScore,
      phone,
      linkedinUrl,
      socialLinks,
      googleRating,
      googleReviews,
      estimatedRevenue: filingInsights.estimatedRevenue,
      companyAgeYears,
      companyNumber: candidate.companyNumber,
    };
  } catch {
    return null;
  }
}
