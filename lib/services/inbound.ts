import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { intentParsePrompt } from "@/lib/prompts/intent";
import {
  findCompanyByDomain,
  upsertCompany,
} from "@/lib/services/companies";
import {
  findContactByEmail,
  upsertContact,
} from "@/lib/services/contacts";
import { logTimelineEvent } from "@/lib/services/timeline";
import type {
  Company,
  Contact,
  Deal,
  IntentResult,
  ResendInboundPayload,
  ResponseIntent,
} from "@/types";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export interface ProcessInboundResult {
  matched: boolean;
  routing: "matched" | "unmatched" | "needs_review";
  email_id: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  intent: ResponseIntent | null;
  intent_summary: string | null;
}

/**
 * Process an inbound email forwarded by Resend.
 *
 * Matching strategy (in order):
 *   1. Look up contact by exact email match
 *   2. Look up company by domain match against the sender's domain
 *   3. If neither, create both as `routing_status = unmatched` so the
 *      Inbox surfaces them for manual classification
 *
 * Once matched, attach to the most recent active deal on the company.
 * If there's no active deal, create a fresh one in stage `discovery` since
 * an inbound reply is a clear progression past `lead`.
 *
 * Always: insert the email row, classify intent via Claude, write timeline
 * event, return the routing outcome.
 */
export async function processInbound(
  payload: ResendInboundPayload,
): Promise<ProcessInboundResult> {
  const sb = getSupabaseAdmin();
  const senderEmail = parseAddress(payload.from);
  const senderDomain = senderEmail?.split("@")[1] ?? null;

  // 1. Find contact by exact email
  let contact: Contact | null = senderEmail
    ? await findContactByEmail(senderEmail)
    : null;

  // 2. Find company by domain
  let company: Company | null = null;
  if (contact?.company_id) {
    const { data } = await sb
      .from("companies")
      .select("*")
      .eq("id", contact.company_id)
      .maybeSingle();
    company = (data as Company) ?? null;
  } else if (senderDomain) {
    company = await findCompanyByDomain(senderDomain);
  }

  // 3. Create stubs if unmatched (so the Inbox can surface them)
  let routing: "matched" | "unmatched" | "needs_review" = "matched";
  if (!company && senderDomain) {
    const { company: created } = await upsertCompany(
      {
        name: domainToName(senderDomain),
        domain: senderDomain,
        source: "manual",
        source_detail: { from_inbound_email: true },
      },
      null,
    );
    company = created;
    routing = "unmatched";
  }
  if (!contact && senderEmail && company) {
    const { contact: created } = await upsertContact(
      {
        company_id: company.id,
        name: senderEmail.split("@")[0],
        email: senderEmail,
        is_primary: false,
        source: "manual",
      },
      null,
    );
    contact = created;
  }

  // 4. Find or create the deal to attach to
  let deal: Deal | null = null;
  if (company) {
    const { data: activeDeals } = await sb
      .from("deals")
      .select("*")
      .eq("company_id", company.id)
      .is("archived_at", null)
      .not("stage", "in", "(won,lost)")
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (activeDeals && activeDeals.length > 0) {
      deal = activeDeals[0] as Deal;
    } else {
      // No active deal — create one in `discovery` since they're replying
      const { data: created } = await sb
        .from("deals")
        .insert({
          company_id: company.id,
          primary_contact_id: contact?.id ?? null,
          title: `${company.name} — inbound`,
          stage: "discovery",
          source: "manual",
          source_detail: { from_inbound_email: true },
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();
      deal = (created as Deal) ?? null;
    }
  }

  // 5. Insert the inbound email row
  const { data: emailRecord, error: emailError } = await sb
    .from("emails")
    .insert({
      direction: "inbound",
      status: "delivered",
      from_address: senderEmail ?? payload.from,
      to_address: payload.to,
      subject: payload.subject,
      body_html: payload.html,
      body_text: payload.text,
      company_id: company?.id ?? null,
      contact_id: contact?.id ?? null,
      deal_id: deal?.id ?? null,
      routing_status: routing,
      thread_id: null, // future: pull from In-Reply-To header
    })
    .select()
    .single();

  if (emailError || !emailRecord) {
    throw new Error(`Failed to insert inbound email: ${emailError?.message}`);
  }

  // 6. Classify intent via Claude (best-effort — failure shouldn't lose the email)
  let intent: ResponseIntent | null = null;
  let intentSummary: string | null = null;
  try {
    const result = await classifyIntent({
      frustration: company?.frustration_hypothesis ?? "operational frustration",
      offeringDescription: dealOfferingDescription(),
      previousSubject: deal
        ? await getLastOutboundSubject(deal.id)
        : "Previous outreach",
      inboundBody: payload.text || payload.html,
    });
    intent = result.intent;
    intentSummary = result.summary;

    await sb
      .from("emails")
      .update({ intent, intent_summary: intentSummary })
      .eq("id", emailRecord.id);

    // Stage advance based on intent (only when there's a deal)
    if (deal && intent === "meeting") {
      await sb
        .from("deals")
        .update({ stage: "discovery", last_activity_at: new Date().toISOString() })
        .eq("id", deal.id)
        .in("stage", ["lead", "qualified"]);
    } else if (deal && intent === "not_interested") {
      await sb
        .from("deals")
        .update({ stage: "lost", last_activity_at: new Date().toISOString() })
        .eq("id", deal.id);
    }
  } catch (err) {
    console.error("intent classification failed", err);
  }

  // 7. Timeline event
  await logTimelineEvent({
    type: "email_received",
    company_id: company?.id ?? null,
    contact_id: contact?.id ?? null,
    deal_id: deal?.id ?? null,
    description: intentSummary ?? `Inbound: ${payload.subject}`,
    metadata: {
      email_id: emailRecord.id,
      intent,
      routing_status: routing,
      from: senderEmail,
    },
  });

  return {
    matched: routing === "matched",
    routing,
    email_id: emailRecord.id,
    company_id: company?.id ?? null,
    contact_id: contact?.id ?? null,
    deal_id: deal?.id ?? null,
    intent,
    intent_summary: intentSummary,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function parseAddress(raw: string): string | null {
  if (!raw) return null;
  // Strip "Name <email@x.com>" wrapper if present
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  if (!addr.includes("@")) return null;
  return addr;
}

function domainToName(domain: string): string {
  const root = domain.split(".")[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function dealOfferingDescription(): string {
  // Best-effort fallback. Reply drafter and briefing pull richer offering data;
  // for intent classification a generic description is fine.
  return "Custom software, integrations, AI tools, and process automation built for how the firm actually works";
}

async function getLastOutboundSubject(dealId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("emails")
    .select("subject")
    .eq("deal_id", dealId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.subject ?? "Previous outreach";
}

async function classifyIntent(vars: {
  frustration: string;
  offeringDescription: string;
  previousSubject: string;
  inboundBody: string;
}): Promise<IntentResult> {
  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: intentParsePrompt({
          frustration: vars.frustration,
          offering_description: vars.offeringDescription,
          previous_subject: vars.previousSubject,
          inbound_body: vars.inboundBody,
        }),
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }
  const jsonMatch = block.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }
  return JSON.parse(jsonMatch[0]) as IntentResult;
}
