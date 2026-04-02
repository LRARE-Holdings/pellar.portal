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

async function extractWebsiteInfo(website: string): Promise<string | null> {
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
    // Extract text content from HTML, strip tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    return text || null;
  } catch {
    return null;
  }
}

async function generateFrustration(vars: {
  company: string;
  industry: string;
  location: string;
  websiteInfo: string | null;
}): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: frustrationHypothesisPrompt({
            company: vars.company,
            industry: vars.industry,
            location: vars.location,
            website_info: vars.websiteInfo,
          }),
        },
      ],
    });

    const block = message.content[0];
    if (block.type === "text") {
      return block.text.trim();
    }
    return "Unable to determine specific frustration for this business.";
  } catch {
    return "Unable to determine specific frustration for this business.";
  }
}

function buildNotes(
  candidate: CompanyCandidate,
  websiteInfo: string | null,
  officers: OfficerResult[],
): string {
  const parts: string[] = [];
  parts.push(`Company number: ${candidate.companyNumber}`);
  parts.push(`SIC codes: ${candidate.sicCodes.join(", ")}`);
  parts.push(`Incorporated: ${candidate.incorporatedDate}`);
  if (officers.length > 0) {
    parts.push(
      `Officers: ${officers.map((o) => `${o.fullName} (${o.role})`).join("; ")}`,
    );
  }
  if (websiteInfo) {
    parts.push(`Website snippet: ${websiteInfo.slice(0, 300)}`);
  }
  return parts.join("\n");
}

export async function enrichLead(
  candidate: CompanyCandidate,
): Promise<EnrichedLead | null> {
  try {
    // 1. Google Places lookup for website + contact info
    const place = await googlePlaces.findBusiness({
      query: `${candidate.name} ${candidate.location}`,
      region: "uk",
    });

    const website = place?.website || null;

    // 2. Website info extraction (simple fetch + text extract, no JS rendering)
    let websiteInfo: string | null = null;
    if (website) {
      websiteInfo = await extractWebsiteInfo(website);
    }

    // 3. Contact person from Companies House officers
    const officers = await companiesHouse.getOfficers(
      candidate.companyNumber,
    );
    const contact = pickBestContact(officers);

    // 4. Email construction
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

    // 5. Frustration hypothesis via Claude
    const frustration = await generateFrustration({
      company: candidate.name,
      industry: candidate.industry,
      location: candidate.location,
      websiteInfo,
    });

    // 6. Match offering
    const offering = matchOffering(frustration, candidate.industry);

    return {
      company: candidate.name,
      contactName: contact?.fullName || "Unknown",
      contactEmail: email,
      industry: candidate.industry,
      location: candidate.location,
      website,
      frustration,
      offering,
      source: candidate.source,
      notes: buildNotes(candidate, websiteInfo, officers),
    };
  } catch {
    return null;
  }
}
