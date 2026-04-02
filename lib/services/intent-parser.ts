import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { intentParsePrompt } from "@/lib/prompts/intent";
import { generateBriefing } from "@/lib/services/briefing-gen";
import type {
  Lead,
  InboundResult,
  IntentResult,
  ResendInboundPayload,
  OfferingType,
} from "@/types";
import { OFFERING_DESCRIPTIONS } from "@/types";

async function getLastOutboundSubject(leadId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("emails")
    .select("subject")
    .eq("lead_id", leadId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.subject || "Previous outreach";
}

async function parseIntent(vars: {
  frustration: string;
  offeringDescription: string;
  previousSubject: string;
  inboundBody: string;
}): Promise<IntentResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
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

  const text = block.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }

  return JSON.parse(jsonMatch[0]) as IntentResult;
}

export async function processInbound(
  payload: ResendInboundPayload,
): Promise<InboundResult> {
  const senderEmail = payload.from;

  // 1. Match to lead
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("contact_email", senderEmail)
    .single();

  if (!lead) return { matched: false };

  const typedLead = lead as Lead;

  // 2. Store inbound email
  const { data: email } = await supabaseAdmin
    .from("emails")
    .insert({
      lead_id: typedLead.id,
      direction: "inbound",
      status: "delivered",
      from_address: senderEmail,
      to_address: "hello@inbound.pellar.co.uk",
      subject: payload.subject,
      body_html: payload.html,
      body_text: payload.text,
    })
    .select()
    .single();

  // 3. Classify intent via Claude
  const intentResult = await parseIntent({
    frustration: typedLead.frustration || "",
    offeringDescription:
      OFFERING_DESCRIPTIONS[typedLead.offering as OfferingType] ||
      OFFERING_DESCRIPTIONS.software,
    previousSubject: await getLastOutboundSubject(typedLead.id),
    inboundBody: payload.text || payload.html,
  });

  // 4. Update email with intent
  if (email) {
    await supabaseAdmin
      .from("emails")
      .update({
        intent: intentResult.intent,
        intent_summary: intentResult.summary,
      })
      .eq("id", email.id);
  }

  // 5. Act on intent
  let briefingGenerated = false;
  if (["meeting", "more_info"].includes(intentResult.intent)) {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "responded" })
      .eq("id", typedLead.id);
    await generateBriefing(typedLead.id);
    briefingGenerated = true;
  } else if (intentResult.intent === "not_interested") {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "lost" })
      .eq("id", typedLead.id);
  } else if (intentResult.intent === "unclear") {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "responded" })
      .eq("id", typedLead.id);
  }
  // out_of_office: no stage change

  // 6. Log activity
  await supabaseAdmin.from("activity_log").insert({
    lead_id: typedLead.id,
    type: "email_received",
    description: intentResult.summary,
    metadata: { intent: intentResult.intent },
  });

  return {
    matched: true,
    leadId: typedLead.id,
    intent: intentResult.intent,
    intentSummary: intentResult.summary,
    briefingGenerated,
  };
}
