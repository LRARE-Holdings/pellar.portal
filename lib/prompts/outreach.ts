/**
 * Outreach prompt — warm, personal, situation-aware.
 *
 * The model gets the actual reason this email exists (referral, content,
 * inbound form, met at an event, etc.) plus everything we know about the
 * person and the moment. Voice is taught through two short positive samples
 * rather than a long list of don'ts — that produces noticeably less robotic
 * output than negative-rule-only prompts.
 */

export interface ReachContext {
  /** First name preferred — full name is fine, the prompt will use it sensibly. */
  contact_name: string;
  /** Job title if known. Helps the model pick register and angle. */
  contact_title: string | null;
  contact_email: string;
  company: string;
  industry: string | null;
  location: string | null;
  /**
   * The kind of relationship that brought us here. Drives the opening
   * register completely.
   */
  reach_kind:
    | "referral"
    | "warm_inbound" // contact form, replied to LinkedIn post, etc.
    | "content_response" // they engaged with something Alex wrote
    | "event_followup" // met at an event
    | "curated_outbound" // hand-picked target, no prior contact
    | "unknown";
  /**
   * The single most important context the user wants the model to weave in.
   * Free-form — usually 1-3 sentences typed by Alex when triggering the draft.
   * e.g. "Sarah at Bevan Brittan introduced us. She mentioned you're stuck
   * with a Sage + Excel handoff that's costing your paralegals an hour a day."
   */
  personal_context: string | null;
  /**
   * Best-guess operational pain. Used as a fallback when personal_context is
   * empty, so the email still has something concrete to anchor to.
   */
  frustration_hypothesis: string | null;
  /** Recent activity on this lead (last 5 timeline event descriptions). */
  recent_activity: string[];
  /** Any free-text notes the user has logged on the company or deal. */
  notes: string | null;
  /**
   * What Pellar would likely build for them. One sentence, plain language.
   * Used to anchor the email's "what I'd be thinking about" beat.
   */
  offering_summary: string;
}

export function outreachPrompt(ctx: ReachContext): string {
  const firstName = ctx.contact_name.split(" ")[0] || ctx.contact_name;

  const situation = describeSituation(ctx);

  return `You are Alex. You run Pellar, a small founder-led studio in the North East
of England that builds custom software, integrations, and AI tools for
professional services firms — usually £15-80k projects, sometimes bigger.
You're not a SaaS vendor. You build things specific to how a firm actually
works. You've spoken to a lot of these firms and you know the operational
gaps better than they do.

You're writing a short email to ${firstName}${ctx.contact_title ? `, ${ctx.contact_title}` : ""} at ${ctx.company}${ctx.location ? ` in ${ctx.location}` : ""}.

WHY YOU'RE WRITING:
${situation}

WHAT YOU KNOW ABOUT THEM:
${describeKnowledge(ctx)}

VOICE
Alex writes like a person, not a sales template. The reader should feel
like a real human took two minutes to think about them and typed
something, not like a sequence ran. Three things matter:

1. Open with something specific to them. The first sentence has to earn
   the second. If you can't honestly write a specific opener, fall back to
   the actual reason for getting in touch — being upfront beats being
   vague.

2. Show you've thought about their world. One short observation about a
   pattern you see in firms like theirs, or one thing you'd be curious
   about if you sat down with them. Don't pitch. Don't list services.
   Just demonstrate you know what their day looks like.

3. End with a low-friction next step. Not "book a 30-minute discovery
   call". Something like "happy to compare notes on what other firms have
   tried" or "if any of that lands, I'd be curious to hear what you're
   working with currently". The reader should be able to reply in one
   sentence.

Write at most 110 words. Vary sentence length naturally — short, then a
longer one when it fits the rhythm. The body should be one or two short
paragraphs. No greeting, no sign-off in the body — those are added
separately.

Avoid: buzzwords (leverage, streamline, unlock, seamless, robust,
scalable, cutting-edge, holistic, synergy, bespoke, transform, empower),
em dashes, exclamation marks, "I hope this finds you well", "I noticed
that", "I came across", "I was looking at your website", bullet points,
bold text, links, anything that mentions Pellar's website, anything
about time tracking or billing software (they already have that).

POSITIVE EXAMPLES of how Alex sounds:

Example 1 (warm intro):
"Sarah said you'd been wrestling with the way matters get handed between
fee earners and ops at month end. I see this exact thing at most legal
practices we work with — usually it's a Frankenstein of Outlook flags,
shared inboxes, and one person who knows where everything lives. We've
built a couple of small tools to make that handoff visible without making
anyone change how they work. Worth a 20-minute conversation if you'd
find it useful."

Example 2 (cold but specific):
"Most accountancy practices your size hit the same wall around year
three: the spreadsheet that runs the whole client onboarding pipeline
becomes a person, and that person is irreplaceable. I'd be curious how
you handle that at ${ctx.company}, because the firms I've spoken to
about it are split roughly down the middle — some lean into a bigger
SaaS, some get something custom built that fits their actual workflow.
Happy to share what's working for the latter group if it's useful."

Notice both: specific opener, one observation showing they know the
sector, no pitch, soft close, under 100 words, one paragraph or two
short ones.

Now write the email to ${firstName}.

Return ONLY a JSON object, no preamble:
{
  "subject": "<under 50 chars, references their world not Pellar, lowercase fine>",
  "body_html": "<one or two short <p> tags, NO greeting, NO sign-off>",
  "body_text": "<plain text version with paragraph breaks, NO greeting, NO sign-off>"
}`;
}

// ----------------------------------------------------------------------------
// Situation describer — turns reach_kind + personal_context into a short
// natural-language brief that the model uses to choose the opening register.
// ----------------------------------------------------------------------------

function describeSituation(ctx: ReachContext): string {
  const personal = ctx.personal_context?.trim();

  switch (ctx.reach_kind) {
    case "referral":
      return personal
        ? `This is a warm intro. Specifically: ${personal}\n\nLead with the introduction. Mention whoever made it by name if it's in the context. The opening sentence should make it obvious you're not coming in cold.`
        : `This is a warm intro from a mutual contact. Lead with the introduction in the opening sentence so they immediately know this isn't cold. If you don't know who introduced you, say "we have a mutual contact who suggested I reach out" — never invent a name.`;

    case "warm_inbound":
      return personal
        ? `They came inbound to Pellar. Specifically: ${personal}\n\nThis is a reply to someone who already raised their hand. Be warm, be quick, and reference the specific thing they mentioned. Don't make them re-explain what they already told you.`
        : `They came inbound to Pellar — contact form, replied to a post, or similar. Be warm and acknowledge that. Don't pitch — they already know who Pellar is. Move the conversation toward a specific question or a short call.`;

    case "content_response":
      return personal
        ? `They engaged with something Alex wrote or shared. Specifically: ${personal}\n\nReference the specific piece in the opening. Treat this as a peer-to-peer message between two people who care about the same thing.`
        : `They engaged with something Alex wrote or shared publicly. Reference the topic naturally in the opening — peer-to-peer, not vendor-to-prospect.`;

    case "event_followup":
      return personal
        ? `Alex met them in person recently. Specifically: ${personal}\n\nOpen with a callback to the conversation. Make it feel like a continuation, not a fresh pitch.`
        : `Alex met them at an event recently. Open with a callback to the moment of meeting. Don't restart the conversation from zero.`;

    case "curated_outbound":
      return personal
        ? `Hand-picked outreach. There's a real specific reason they're a good fit. Specifically: ${personal}\n\nUse that specific reason as the opening. This isn't a list email — make it obvious you chose them.`
        : `Hand-picked outreach. No prior contact, but Alex specifically chose this firm because of something about their situation. Open with a concrete observation about firms like theirs that earns the right to keep reading.`;

    case "unknown":
    default:
      return personal
        ? `Context: ${personal}\n\nUse that as the spine of the opening.`
        : `No prior relationship and no specific trigger. Default to a respectful, observation-led cold opening — name a specific operational pattern you see in firms like theirs and ask one short question. Don't pretend to know more than you do.`;
  }
}

// ----------------------------------------------------------------------------
// Knowledge describer — assembles everything we know about them into a short
// brief, dropping anything that's null/empty.
// ----------------------------------------------------------------------------

function describeKnowledge(ctx: ReachContext): string {
  const lines: string[] = [];

  if (ctx.industry) lines.push(`Sector: ${ctx.industry}`);
  if (ctx.contact_title) lines.push(`Their role: ${ctx.contact_title}`);
  if (ctx.frustration_hypothesis) {
    lines.push(`Likely operational pain: ${ctx.frustration_hypothesis}`);
  }
  lines.push(
    `What Pellar would likely build for them: ${ctx.offering_summary}`,
  );
  if (ctx.notes) {
    lines.push(`Notes Alex has logged on this account:\n${ctx.notes}`);
  }
  if (ctx.recent_activity.length > 0) {
    lines.push(
      `Recent activity on this account:\n${ctx.recent_activity
        .slice(0, 5)
        .map((a) => `  - ${a}`)
        .join("\n")}`,
    );
  }

  return lines.join("\n");
}

// ----------------------------------------------------------------------------
// Backwards compatibility shim for any caller still using the old signature.
// Maps the legacy fields onto the new ReachContext with reach_kind="unknown".
// ----------------------------------------------------------------------------

export function initialOutreachPrompt(vars: {
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
  offering_description: string;
}): string {
  return outreachPrompt({
    contact_name: vars.contact_name,
    contact_title: null,
    contact_email: "",
    company: vars.company,
    industry: vars.industry,
    location: vars.location,
    reach_kind: "unknown",
    personal_context: null,
    frustration_hypothesis: vars.frustration,
    recent_activity: [],
    notes: null,
    offering_summary: vars.offering_description,
  });
}
