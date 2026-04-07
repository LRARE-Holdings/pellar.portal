import { NextRequest, NextResponse } from "next/server";
import { upsertCompany } from "@/lib/services/companies";
import { upsertContact } from "@/lib/services/contacts";
import { createDeal } from "@/lib/services/deals";
import { getOfferingBySlug } from "@/lib/services/offerings";
import { logTimelineEvent } from "@/lib/services/timeline";

// Public contact intake endpoint. Called by pellar.co.uk's contact form.
// No authentication — guarded only by basic validation, length caps, and a
// honeypot field. The middleware excludes this route from auth.
//
// Inserts into the relationship-first schema:
//   1. upsert company by domain (extracted from email or company field)
//   2. upsert contact by email
//   3. create a new deal in stage `lead`
//   4. log a timeline event so the inbox sees it
// The form's interest/budget/message body is stored on the company notes
// and on the deal source_detail so it's queryable later.

const ALLOWED_ORIGINS = new Set([
  "https://www.pellar.co.uk",
  "https://pellar.co.uk",
  "http://localhost:3000",
  "http://localhost:3001",
]);

const INTEREST_LABELS: Record<string, string> = {
  web_app: "Web application",
  mvp: "MVP / new product",
  website: "Website",
  retainer: "Ongoing development / retainer",
  pipeline: "Sales pipeline solution",
  referral: "Referral tracking",
  ai_notes: "AI note taking",
  ai_crm: "AI-driven CRM",
  custom_ai: "Custom AI build",
  other: "Something else",
};

const BUDGET_LABELS: Record<string, string> = {
  under_5k: "Under £5k",
  "5k_15k": "£5k – £15k",
  "15k_40k": "£15k – £40k",
  "40k_plus": "£40k+",
  retainer: "Monthly retainer",
  unsure: "Not sure yet",
};

interface ContactBody {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  interest?: unknown;
  budget?: unknown;
  message?: unknown;
  // Honeypot
  website?: unknown;
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function clean(v: unknown, max: number): string {
  if (!isString(v)) return "";
  return v.trim().slice(0, max);
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers },
    );
  }

  // Honeypot — silently accept and discard
  if (isString(body.website) && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 200);
  const interestRaw = clean(body.interest, 60);
  const budget = clean(body.budget, 60);
  const message = clean(body.message, 4000);

  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400, headers },
    );
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400, headers },
    );
  }
  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400, headers },
    );
  }

  const interestLabel = INTEREST_LABELS[interestRaw] ?? null;
  const budgetLabel = BUDGET_LABELS[budget] ?? null;

  // Map interest tag → offering slug
  const offeringSlug = interestToOffering(interestRaw);
  // Rough deal value estimate from budget tag
  const estimatedValue = budgetToValue(budget);

  try {
    // 1. Upsert company. Use the provided company name if any, else fall back
    //    to the email domain to keep the row useful.
    const emailDomain = email.split("@")[1] ?? null;
    const companyName =
      company || (emailDomain ? domainToName(emailDomain) : `${name} (inbound)`);

    const { company: companyRow } = await upsertCompany(
      {
        name: companyName,
        domain: emailDomain,
        website: emailDomain ? `https://${emailDomain}` : null,
        source: "contact_form",
        source_detail: {
          interest: interestRaw || null,
          budget: budget || null,
          origin: origin || null,
        },
        notes: message,
      },
      null,
    );

    // 2. Upsert contact by email. Mark as primary if it's the first contact.
    const { contact: contactRow } = await upsertContact(
      {
        company_id: companyRow.id,
        name,
        email,
        is_primary: true,
        source: "contact_form",
        source_detail: {
          interest: interestRaw || null,
          budget: budget || null,
        },
      },
      null,
    );

    // 3. Create a new deal at stage `lead`
    const offering = offeringSlug ? await getOfferingBySlug(offeringSlug) : null;
    const dealTitle = company
      ? `${company} — ${interestLabel ?? "Inbound enquiry"}`
      : `${name} — ${interestLabel ?? "Inbound enquiry"}`;

    const deal = await createDeal(
      {
        company_id: companyRow.id,
        primary_contact_id: contactRow.id,
        offering_id: offering?.id ?? null,
        title: dealTitle,
        stage: "lead",
        value: estimatedValue,
        source: "contact_form",
        source_detail: {
          interest: interestRaw || null,
          interest_label: interestLabel,
          budget: budget || null,
          budget_label: budgetLabel,
          message,
          origin: origin || null,
        },
        notes: message,
      },
      null,
    );

    // 4. Surface in the Inbox via a timeline event
    await logTimelineEvent({
      type: "deal_created",
      company_id: companyRow.id,
      contact_id: contactRow.id,
      deal_id: deal.id,
      description: `Inbound enquiry: ${interestLabel ?? "general"}${
        budgetLabel ? ` · ${budgetLabel}` : ""
      }`,
      metadata: {
        source: "website_contact_form",
        message: message.slice(0, 500),
      },
    });

    return NextResponse.json(
      { ok: true, deal_id: deal.id },
      { status: 200, headers },
    );
  } catch (err) {
    console.error("contact form processing failed", err);
    return NextResponse.json(
      { error: "Could not record submission" },
      { status: 500, headers },
    );
  }
}

function interestToOffering(interest: string): string | null {
  // Pellar offerings: software, integration, ai, automation
  const map: Record<string, string> = {
    web_app: "software",
    mvp: "software",
    website: "software",
    retainer: "software",
    pipeline: "automation",
    referral: "automation",
    ai_notes: "ai",
    ai_crm: "ai",
    custom_ai: "ai",
  };
  return map[interest] ?? null;
}

function budgetToValue(budget: string): number | null {
  // Conservative midpoint per band, in GBP
  switch (budget) {
    case "under_5k":
      return 3000;
    case "5k_15k":
      return 10000;
    case "15k_40k":
      return 25000;
    case "40k_plus":
      return 60000;
    case "retainer":
      return 36000; // 12 × £3k as a placeholder
    default:
      return null;
  }
}

function domainToName(domain: string): string {
  // "acmelegal.co.uk" → "Acmelegal"
  const root = domain.split(".")[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}
