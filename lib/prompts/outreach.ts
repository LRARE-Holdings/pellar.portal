export function initialOutreachPrompt(vars: {
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
  offering_description: string;
}) {
  const firstName = vars.contact_name.split(" ")[0] || vars.contact_name;

  return `Write a short cold email from Alex at Pellar to ${firstName} at ${vars.company}.

The recipient:
- ${vars.company} is a ${vars.industry} firm in ${vars.location}
- Their likely gap: ${vars.frustration}
- What we could build: ${vars.offering_description}

Pellar:
- Builds custom software, integrations, and AI tools for professional services firms
- Not a SaaS product. We build things specific to how the firm actually works.
- North East based, small team, founder-led

CRITICAL WRITING RULES:
- This must read like a genuine email from a real person, not AI-generated marketing copy
- Vary sentence length naturally. Short sentences. Then a slightly longer one when it fits.
- NO buzzwords: leverage, streamline, cutting-edge, empower, unlock, seamless, innovative, robust, scalable, digital transformation, holistic, synergy, bespoke, state-of-the-art
- No em dashes
- No exclamation marks
- Do NOT start with "I hope this finds you well", "I noticed that", "I came across", "I was looking at your website"
- Instead, open by naming a specific problem they probably have. Frame it as a question or observation that shows you understand their world.
- Keep it under 100 words. Genuinely short. Most cold emails are too long.
- End with a low-pressure CTA. Not "book a call" or "schedule a demo". More like "happy to share how we approached this for a similar firm if it's useful" or "worth a quick conversation?"
- Sign off as just "Alex"
- The email should feel like it was written by someone who has spoken to lots of firms like theirs and understands the specific operational gaps

DO NOT:
- Mention time tracking, billing, or practice management (they have software for that)
- Use bullet points
- Use bold text
- Include links
- Mention Pellar's website

Return ONLY a JSON object:
{
  "subject": "<under 50 chars, references their problem not Pellar, lowercase fine>",
  "body_html": "<body only, <p> tags only, NO greeting or sign-off>",
  "body_text": "<plain text version, NO greeting or sign-off>"
}`;
}
