import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { resend } from "@/lib/resend";
import { wrapInBrandedTemplate, styleParagraphs } from "@/lib/email-template";
import { outreachPrompt, type ReachContext } from "@/lib/prompts/outreach";
import { replyDraftPrompt } from "@/lib/prompts/reply-draft";
import { logTimelineEvent } from "@/lib/services/timeline";
import { getDealWithRelations } from "@/lib/services/deals";
import { getContact } from "@/lib/services/contacts";
import { getCompany } from "@/lib/services/companies";
import { getOffering } from "@/lib/services/offerings";
import { listNotes } from "@/lib/services/notes";
import { listTimelineEvents } from "@/lib/services/timeline";
import type { DraftedEmail, EmailDraft, LeadSource } from "@/types";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

// ----------------------------------------------------------------------------
// Generation
// ----------------------------------------------------------------------------

export interface DraftFromDealInput {
  deal_id: string;
  owner_id?: string | null;
  /** Override the to_address (otherwise uses the primary contact's email). */
  to_address?: string;
  /**
   * Free-text context Alex types when triggering the draft. Anchors the
   * email's opening — e.g. "Sarah introduced us at the NE Tech Show last
   * Tuesday and said you're stuck with a Sage + Excel handoff that costs
   * the paralegals an hour a day".
   */
  personal_context?: string | null;
}

/**
 * Draft a fresh outreach email to the primary contact on a deal.
 *
 * Builds a rich ReachContext from:
 *   - the deal's source + source_detail (referral / inbound form / etc.)
 *   - the contact's title
 *   - the company's frustration hypothesis
 *   - any notes Alex has logged on the company or deal
 *   - the most recent 5 timeline events on the deal
 *   - free-text personal_context if Alex passed any
 *
 * The new outreach prompt teaches voice through positive examples rather
 * than a long list of don'ts, which produces noticeably warmer output.
 */
export async function generateInitialDraft(
  input: DraftFromDealInput,
): Promise<EmailDraft> {
  const deal = await getDealWithRelations(input.deal_id);
  if (!deal) throw new Error(`Deal ${input.deal_id} not found`);
  if (!deal.company) throw new Error(`Deal has no company`);
  if (!deal.primary_contact && !input.to_address) {
    throw new Error(`Deal has no primary contact and no to_address`);
  }

  const contact = deal.primary_contact;
  const toAddress = input.to_address ?? contact?.email ?? "";
  if (!toAddress) {
    throw new Error("No to_address available");
  }

  const offering = deal.offering ? await getOffering(deal.offering.id) : null;
  const offeringSummary =
    offering?.description ??
    "Custom software, integrations, and AI tools built for how the firm actually works";

  const company = await getCompany(deal.company.id);
  if (!company) throw new Error("Company not found");

  // Pull notes + recent activity to give the model real context
  const [companyNotes, dealNotes, recentEvents] = await Promise.all([
    listNotes("company", company.id),
    listNotes("deal", deal.id),
    listTimelineEvents({ deal_id: deal.id, limit: 5 }),
  ]);

  const notesText = [
    ...companyNotes.map((n) => n.body),
    ...dealNotes.map((n) => n.body),
  ]
    .join("\n\n")
    .trim();

  const recentActivity = recentEvents.map((e) => e.description);

  const reachKind = leadSourceToReachKind(deal.source);

  const ctx: ReachContext = {
    contact_name: contact?.name ?? "there",
    contact_title: contact?.title ?? null,
    contact_email: toAddress,
    company: deal.company.name,
    industry: deal.company.industry ?? null,
    location: deal.company.location ?? null,
    reach_kind: reachKind,
    personal_context: input.personal_context?.trim() || null,
    frustration_hypothesis: company.frustration_hypothesis ?? null,
    recent_activity: recentActivity,
    notes: notesText.length > 0 ? notesText : null,
    offering_summary: offeringSummary,
  };

  const prompt = outreachPrompt(ctx);
  const drafted = await callClaudeForEmail(prompt);

  return persistDraft({
    company_id: deal.company.id,
    contact_id: contact?.id ?? null,
    deal_id: deal.id,
    in_reply_to_email_id: null,
    to_address: toAddress,
    subject: drafted.subject,
    body_html: drafted.body_html,
    body_text: drafted.body_text,
    ai_prompt_used: prompt,
    owner_id: input.owner_id ?? null,
  });
}

/**
 * Map a deal's structured source field onto the prompt's reach_kind enum.
 * Determines the opening register the model picks (warm intro vs cold).
 */
function leadSourceToReachKind(
  source: LeadSource,
): ReachContext["reach_kind"] {
  switch (source) {
    case "referral":
      return "referral";
    case "contact_form":
      return "warm_inbound";
    case "content":
      return "content_response";
    case "linkedin":
      return "content_response";
    case "event":
      return "event_followup";
    case "outbound":
      return "curated_outbound";
    case "discovery":
      return "curated_outbound";
    case "manual":
    default:
      return "unknown";
  }
}

export interface DraftReplyInput {
  in_reply_to_email_id: string;
  owner_id?: string | null;
  /** Optional free-text from Alex steering the reply. */
  personal_context?: string | null;
}

/**
 * Draft a reply to an inbound email. Pulls the inbound, the prior thread,
 * notes, and the deal context, then asks Claude for a human-sounding reply.
 *
 * The new prompt drops per-intent template scripts in favour of a single
 * voice prompt with positive examples. The intent label is still passed
 * through but as a hint, not a script.
 */
export async function generateReplyDraft(
  input: DraftReplyInput,
): Promise<EmailDraft> {
  const sb = getSupabaseAdmin();

  const { data: inbound, error } = await sb
    .from("emails")
    .select("*")
    .eq("id", input.in_reply_to_email_id)
    .maybeSingle();
  if (error || !inbound) {
    throw new Error(`Email ${input.in_reply_to_email_id} not found`);
  }
  if (inbound.direction !== "inbound") {
    throw new Error(`Email is not inbound`);
  }

  const contact = inbound.contact_id
    ? await getContact(inbound.contact_id)
    : null;
  const company = inbound.company_id
    ? await getCompany(inbound.company_id)
    : null;
  const deal = inbound.deal_id
    ? await getDealWithRelations(inbound.deal_id)
    : null;

  // Pull last 5 emails on the same deal for thread context
  let priorThread: string | null = null;
  if (inbound.deal_id) {
    const { data: thread } = await sb
      .from("emails")
      .select("direction, subject, body_text, created_at, from_address")
      .eq("deal_id", inbound.deal_id)
      .neq("id", inbound.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (thread && thread.length > 0) {
      priorThread = thread
        .map(
          (m) =>
            `[${m.direction} ${new Date(m.created_at).toISOString().slice(0, 10)}] ${m.subject}\n${(m.body_text ?? "").slice(0, 400)}`,
        )
        .join("\n---\n");
    }
  }

  // Pull notes from both the company and the deal
  const [companyNotes, dealNotes] = await Promise.all([
    company ? listNotes("company", company.id) : Promise.resolve([]),
    deal ? listNotes("deal", deal.id) : Promise.resolve([]),
  ]);
  const notesText = [
    ...companyNotes.map((n) => n.body),
    ...dealNotes.map((n) => n.body),
  ]
    .join("\n\n")
    .trim();

  const prompt = replyDraftPrompt({
    contact_name: contact?.name ?? inbound.from_address.split("@")[0],
    contact_title: contact?.title ?? null,
    company: company?.name ?? "their firm",
    industry: company?.industry ?? null,
    inbound_subject: inbound.subject,
    inbound_body: inbound.body_text ?? inbound.body_html ?? "",
    intent: inbound.intent ?? "unclear",
    intent_summary: inbound.intent_summary ?? "",
    deal_stage: deal?.stage ?? null,
    prior_thread: priorThread,
    frustration_hypothesis: company?.frustration_hypothesis ?? null,
    notes: notesText.length > 0 ? notesText : null,
    personal_context: input.personal_context?.trim() || null,
  });

  const drafted = await callClaudeForEmail(prompt);

  return persistDraft({
    company_id: inbound.company_id,
    contact_id: inbound.contact_id,
    deal_id: inbound.deal_id,
    in_reply_to_email_id: inbound.id,
    to_address: inbound.from_address,
    subject: drafted.subject.startsWith("Re:")
      ? drafted.subject
      : `Re: ${inbound.subject}`,
    body_html: drafted.body_html,
    body_text: drafted.body_text,
    ai_prompt_used: prompt,
    owner_id: input.owner_id ?? null,
  });
}

// ----------------------------------------------------------------------------
// Persistence
// ----------------------------------------------------------------------------

interface PersistDraftInput {
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  in_reply_to_email_id: string | null;
  to_address: string;
  subject: string;
  body_html: string;
  body_text: string;
  ai_prompt_used: string | null;
  owner_id: string | null;
}

async function persistDraft(input: PersistDraftInput): Promise<EmailDraft> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("email_drafts")
    .insert({
      ...input,
      generated_by: "ai",
      status: "ready",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to persist draft: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "draft_created",
    company_id: input.company_id,
    contact_id: input.contact_id,
    deal_id: input.deal_id,
    description: `AI draft created: "${input.subject}"`,
    actor_id: input.owner_id,
    metadata: { draft_id: data.id, in_reply_to: input.in_reply_to_email_id },
  });

  return data as EmailDraft;
}

// ----------------------------------------------------------------------------
// Updates
// ----------------------------------------------------------------------------

export interface UpdateDraftInput {
  subject?: string;
  body_html?: string;
  body_text?: string;
  to_address?: string;
}

export async function updateDraft(
  id: string,
  input: UpdateDraftInput,
): Promise<EmailDraft> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("email_drafts")
    .update({ ...input, generated_by: "user" })
    .eq("id", id)
    .eq("status", "ready") // can only edit while ready/draft
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update draft: ${error?.message}`);
  }
  return data as EmailDraft;
}

export async function discardDraft(
  id: string,
  actorId?: string | null,
): Promise<EmailDraft> {
  const sb = getSupabaseAdmin();
  const before = await getDraft(id);
  if (!before) throw new Error(`Draft ${id} not found`);

  const { data, error } = await sb
    .from("email_drafts")
    .update({
      status: "discarded",
      discarded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to discard draft: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "draft_discarded",
    company_id: before.company_id,
    contact_id: before.contact_id,
    deal_id: before.deal_id,
    description: `Draft discarded: "${before.subject}"`,
    actor_id: actorId ?? null,
    metadata: { draft_id: id },
  });

  return data as EmailDraft;
}

// ----------------------------------------------------------------------------
// Approve & send
// ----------------------------------------------------------------------------

export interface ApproveDraftResult {
  draft: EmailDraft;
  email_id: string;
  resend_id: string | null;
}

/**
 * Approve a draft and immediately send via Resend.
 *
 * Idempotency:
 *   * The draft has a partial unique index on (id) WHERE status='approved'.
 *   * The status-transition trigger blocks any change away from 'approved'.
 *   * We do the status transition BEFORE the send, so a double-click second
 *     call hits the unique index and throws.
 */
export async function approveDraft(
  id: string,
  actorId: string | null,
): Promise<ApproveDraftResult> {
  const sb = getSupabaseAdmin();
  const draft = await getDraft(id);
  if (!draft) throw new Error(`Draft ${id} not found`);
  if (draft.status === "approved") {
    throw new Error("Draft already approved");
  }
  if (draft.status === "discarded") {
    throw new Error("Cannot approve a discarded draft");
  }

  // 1. Insert the immutable email row first (status: queued)
  const wrappedHtml = wrapInBrandedTemplate({
    bodyHtml: styleParagraphs(draft.body_html),
  });

  const { data: emailRecord, error: emailError } = await sb
    .from("emails")
    .insert({
      company_id: draft.company_id,
      contact_id: draft.contact_id,
      deal_id: draft.deal_id,
      direction: "outbound",
      status: "queued",
      from_address: "alex@pellar.co.uk",
      to_address: draft.to_address,
      subject: draft.subject,
      body_html: wrappedHtml,
      body_text: draft.body_text,
      source_draft_id: draft.id,
      in_reply_to: draft.in_reply_to_email_id,
      thread_id: draft.in_reply_to_email_id ?? null,
      routing_status: "matched",
    })
    .select()
    .single();
  if (emailError || !emailRecord) {
    throw new Error(`Failed to insert email row: ${emailError?.message}`);
  }

  // 2. Transition the draft to approved (this is the idempotency point —
  //    the partial unique index will reject a second concurrent attempt)
  const { data: approvedDraft, error: approveError } = await sb
    .from("email_drafts")
    .update({
      status: "approved",
      approved_email_id: emailRecord.id,
      approved_at: new Date().toISOString(),
      approved_by: actorId,
    })
    .eq("id", draft.id)
    .eq("status", draft.status) // optimistic lock
    .select()
    .single();
  if (approveError || !approvedDraft) {
    // Roll back the email insert so we don't leave an orphan
    await sb.from("emails").delete().eq("id", emailRecord.id);
    throw new Error(
      `Failed to approve draft (race?): ${approveError?.message}`,
    );
  }

  // 3. Send via Resend
  let resendId: string | null = null;
  try {
    const result = await resend.emails.send({
      from: "Alex at Pellar <alex@pellar.co.uk>",
      to: draft.to_address,
      subject: draft.subject,
      html: wrappedHtml,
      text: draft.body_text,
      replyTo: "alex@inbound.pellar.co.uk",
      tags: draft.deal_id
        ? [{ name: "deal_id", value: draft.deal_id }]
        : undefined,
    });
    resendId = result.data?.id ?? null;

    await sb
      .from("emails")
      .update({
        status: "sent",
        resend_id: resendId,
        message_id: resendId,
      })
      .eq("id", emailRecord.id);
  } catch (sendError) {
    await sb
      .from("emails")
      .update({ status: "failed" })
      .eq("id", emailRecord.id);
    throw new Error(
      `Failed to send via Resend: ${sendError instanceof Error ? sendError.message : "unknown"}`,
    );
  }

  // 4. Log timeline + bump deal
  await logTimelineEvent({
    type: "email_sent",
    company_id: draft.company_id,
    contact_id: draft.contact_id,
    deal_id: draft.deal_id,
    description: `Sent: "${draft.subject}"`,
    actor_id: actorId,
    metadata: {
      email_id: emailRecord.id,
      draft_id: draft.id,
      resend_id: resendId,
    },
  });

  await logTimelineEvent({
    type: "draft_approved",
    company_id: draft.company_id,
    contact_id: draft.contact_id,
    deal_id: draft.deal_id,
    description: `Draft approved by user`,
    actor_id: actorId,
    metadata: { draft_id: draft.id, email_id: emailRecord.id },
  });

  return {
    draft: approvedDraft as EmailDraft,
    email_id: emailRecord.id,
    resend_id: resendId,
  };
}

// ----------------------------------------------------------------------------
// Read helpers
// ----------------------------------------------------------------------------

export async function getDraft(id: string): Promise<EmailDraft | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("email_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch draft: ${error.message}`);
  }
  return (data as EmailDraft) ?? null;
}

export interface ListDraftsOptions {
  status?: "draft" | "ready" | "approved" | "discarded";
  deal_id?: string;
  company_id?: string;
  limit?: number;
}

export async function listDrafts(
  opts: ListDraftsOptions = {},
): Promise<EmailDraft[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("email_drafts").select("*");
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.deal_id) q = q.eq("deal_id", opts.deal_id);
  if (opts.company_id) q = q.eq("company_id", opts.company_id);
  q = q.order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to list drafts: ${error.message}`);
  }
  return (data ?? []) as EmailDraft[];
}

// ----------------------------------------------------------------------------
// Claude helper
// ----------------------------------------------------------------------------

async function callClaudeForEmail(prompt: string): Promise<DraftedEmail> {
  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const jsonMatch = block.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }
  const parsed = JSON.parse(jsonMatch[0]) as DraftedEmail;
  if (!parsed.subject || !parsed.body_html || !parsed.body_text) {
    throw new Error("Incomplete email draft from Claude");
  }
  return parsed;
}
