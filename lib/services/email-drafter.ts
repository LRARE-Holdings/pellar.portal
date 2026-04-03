import { anthropic } from "@/lib/anthropic";
import { initialOutreachPrompt } from "@/lib/prompts/outreach";
import { followup1Prompt, followup2Prompt } from "@/lib/prompts/followup";
import { wrapInBrandedTemplate, styleParagraphs } from "@/lib/email-template";
import type { Lead, DraftedEmail, OfferingType } from "@/types";
import { OFFERING_DESCRIPTIONS } from "@/types";

export async function draftInitialEmail(lead: Lead): Promise<DraftedEmail> {
  const prompt = initialOutreachPrompt({
    contact_name: lead.contact_name,
    company: lead.company,
    industry: lead.industry,
    location: lead.location,
    frustration: lead.frustration || "operational inefficiency",
    offering_description:
      OFFERING_DESCRIPTIONS[lead.offering as OfferingType] ||
      OFFERING_DESCRIPTIONS.software,
  });

  return callClaudeForEmail(prompt);
}

export async function draftFollowup1(
  lead: Lead,
  previousSubject: string,
  previousBody: string,
): Promise<DraftedEmail> {
  const prompt = followup1Prompt({
    previous_subject: previousSubject,
    previous_body: previousBody,
    contact_name: lead.contact_name,
    company: lead.company,
    industry: lead.industry,
    location: lead.location,
    frustration: lead.frustration || "operational inefficiency",
  });

  return callClaudeForEmail(prompt);
}

export async function draftFollowup2(lead: Lead): Promise<DraftedEmail> {
  const prompt = followup2Prompt({
    contact_name: lead.contact_name,
    company: lead.company,
    frustration: lead.frustration || "operational inefficiency",
  });

  return callClaudeForEmail(prompt);
}

async function callClaudeForEmail(prompt: string): Promise<DraftedEmail> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Extract JSON from the response (may be wrapped in markdown code block)
  const text = block.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as DraftedEmail;

  if (!parsed.subject || !parsed.body_html || !parsed.body_text) {
    throw new Error("Incomplete email draft from Claude");
  }

  // Wrap the raw paragraphs in the branded Pellar email template
  parsed.body_html = wrapInBrandedTemplate({
    bodyHtml: styleParagraphs(parsed.body_html),
  });

  return parsed;
}
