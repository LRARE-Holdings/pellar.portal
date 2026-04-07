/**
 * Prompt for drafting a reply to an inbound email. The intent classifier
 * has already labelled the inbound, so the prompt is conditioned on intent
 * and gives the model a clear role for the response.
 */
export function replyDraftPrompt(vars: {
  contact_name: string;
  company: string;
  inbound_subject: string;
  inbound_body: string;
  intent: string;
  intent_summary: string;
  deal_stage: string | null;
  prior_thread: string | null;
  frustration: string | null;
}) {
  const firstName = vars.contact_name.split(" ")[0] || vars.contact_name;
  const intentGuide = intentGuidance(vars.intent);

  return `Write a short reply from Alex at Pellar to ${firstName} at ${vars.company}.

Their email:
Subject: ${vars.inbound_subject}
Body:
${vars.inbound_body}

Classifier said: ${vars.intent} — ${vars.intent_summary}
Deal stage: ${vars.deal_stage ?? "early"}
${vars.frustration ? `Their likely frustration: ${vars.frustration}` : ""}
${vars.prior_thread ? `\nPrior thread (most recent first):\n${vars.prior_thread}\n` : ""}

How to handle this reply:
${intentGuide}

WRITING RULES:
- Sound like a real person, not AI marketing copy
- Reference something specific from their reply, not a generic acknowledgement
- Vary sentence length naturally
- NO buzzwords (leverage, streamline, cutting-edge, empower, unlock, seamless, innovative, robust, scalable, holistic, synergy, bespoke, state-of-the-art)
- No em dashes
- No exclamation marks
- Don't open with "I hope this finds you well" or "Thanks for your message"
- Keep it under 90 words
- Sign off as just "Alex"

Return ONLY a JSON object:
{
  "subject": "<reply subject — usually 'Re: ' + their subject>",
  "body_html": "<body only, <p> tags only, NO greeting or sign-off>",
  "body_text": "<plain text version, NO greeting or sign-off>"
}`;
}

function intentGuidance(intent: string): string {
  switch (intent) {
    case "meeting":
      return [
        "They want a call. Confirm warmly, propose 2-3 concrete time options",
        "in the next 5 working days, and offer to share a calendar link as backup.",
        "Ask one short question that primes the conversation (e.g. the single",
        "thing it would be most useful to walk through).",
      ].join(" ");
    case "more_info":
      return [
        "They want more detail before committing to a call. Answer one or two",
        "of their specific questions if they asked any. If they were vague, give",
        "a short concrete example of how Pellar approached a similar problem for",
        "another firm. End with a soft offer of a 20-minute conversation, no",
        "pressure.",
      ].join(" ");
    case "not_interested":
      return [
        "They're declining. Be gracious. One sentence acknowledging their reply.",
        "One sentence saying you'll stay out of their inbox but they're welcome",
        "to reach out later. Do not push back, do not ask for a referral, do not",
        "try to reframe.",
      ].join(" ");
    case "out_of_office":
      return [
        "Auto-reply. Just acknowledge and say you'll follow up after they're",
        "back. Two short sentences max.",
      ].join(" ");
    case "unclear":
    default:
      return [
        "The intent isn't clear. Ask one clarifying question that moves the",
        "conversation forward. Don't speculate about what they might have meant.",
      ].join(" ");
  }
}
