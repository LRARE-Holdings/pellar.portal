export function briefingPrompt(vars: {
  company: string;
  industry: string;
  location: string;
  contact_name: string;
  frustration: string;
  offering_description: string;
  response_text: string;
  email_history: string;
  notes: string;
}) {
  return `
You are preparing a scoping call briefing for Pellar, a software company in Newcastle.

Lead: ${vars.company} (${vars.industry}, ${vars.location})
Contact: ${vars.contact_name}
Their problem: ${vars.frustration}
Our recommended offering: ${vars.offering_description}
Their response to our outreach: ${vars.response_text}
Email history:
${vars.email_history}
Internal notes: ${vars.notes}

Generate a JSON object with:
- summary: 2-3 sentence situation overview. Be specific. Reference their industry and problem.
- talking_points: Array of exactly 6 strings. Each is a discussion area for the scoping call. Start with their pain, move to discovery questions, end with next steps. Be commercially practical.
- company_intel: Array of key facts about this lead. Include sector, location, size if known, any red flags or opportunities.

Do not use buzzwords. Do not be generic. Every point should reference something specific to this lead.
Do not use em dashes.
`;
}
