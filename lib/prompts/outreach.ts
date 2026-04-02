export function initialOutreachPrompt(vars: {
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
  offering_description: string;
}) {
  return `
Write a cold outreach email from Alex at Pellar to ${vars.contact_name} at ${vars.company}.

Context:
- They are a ${vars.industry} business in ${vars.location}
- Their likely pain point: ${vars.frustration}
- We want to offer: ${vars.offering_description}

Rules:
- Subject line must reference their specific problem, not Pellar
- 3-5 short paragraphs maximum
- Open by naming their problem directly. Show you understand it.
- Briefly mention that Pellar builds software/integrations/AI for businesses like theirs
- Do not mention pricing
- Do not use buzzwords (digital transformation, leverage, synergy, cutting-edge, empower, unlock, seamless)
- Do not use em dashes
- CTA: suggest a 20-minute call to explore whether there is a fit
- Sign off as Alex, Pellar
- Tone: direct, warm, human. Like a knowledgeable peer, not a salesperson.

Return a JSON object with "subject", "body_html", and "body_text" fields.
body_html should use simple HTML (p tags, no inline styles, no images).
body_text should be the plain text version.
`;
}
