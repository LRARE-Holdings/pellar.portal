import { supabaseAdmin } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { briefingPrompt } from "@/lib/prompts/briefing";
import type { Lead, Email, BriefingResult, OfferingType } from "@/types";
import { OFFERING_DESCRIPTIONS } from "@/types";

export async function generateBriefing(
  leadId: string,
): Promise<BriefingResult> {
  // 1. Fetch lead + all emails
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const typedLead = lead as Lead;

  const { data: emails } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  const typedEmails = (emails || []) as Email[];

  // 2. Find most recent inbound email for context
  const inboundEmail = typedEmails
    .filter((e) => e.direction === "inbound")
    .pop();

  const responseText = inboundEmail?.body_text || inboundEmail?.body_html || "";

  // 3. Build email history string
  const emailHistory = typedEmails
    .map((e) => {
      const dir = e.direction === "outbound" ? "Pellar" : typedLead.contact_name;
      return `[${e.created_at}] ${dir}: ${e.subject}\n${e.body_text || ""}`;
    })
    .join("\n---\n");

  // 4. Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: briefingPrompt({
          company: typedLead.company,
          industry: typedLead.industry,
          location: typedLead.location,
          contact_name: typedLead.contact_name,
          frustration: typedLead.frustration || "",
          offering_description:
            OFFERING_DESCRIPTIONS[typedLead.offering as OfferingType] ||
            OFFERING_DESCRIPTIONS.software,
          response_text: responseText,
          email_history: emailHistory,
          notes: typedLead.notes || "",
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

  const parsed = JSON.parse(jsonMatch[0]) as {
    summary: string;
    talking_points: string[];
    company_intel: string[];
  };

  // 5. Insert into Supabase
  const { data: briefing, error: insertError } = await supabaseAdmin
    .from("briefings")
    .insert({
      lead_id: leadId,
      summary: parsed.summary,
      talking_points: parsed.talking_points,
      company_intel: parsed.company_intel,
      response_context: responseText || null,
    })
    .select()
    .single();

  if (insertError || !briefing) {
    throw new Error("Failed to insert briefing");
  }

  // 6. Log activity
  await supabaseAdmin.from("activity_log").insert({
    lead_id: leadId,
    type: "briefing_generated",
    description: `Briefing generated for ${typedLead.company}`,
  });

  return {
    briefing_id: briefing.id,
    summary: parsed.summary,
    talking_points: parsed.talking_points,
    company_intel: parsed.company_intel,
  };
}
