export function followup1Prompt(vars: {
  previous_subject: string;
  previous_body: string;
  contact_name: string;
  company: string;
  industry: string;
  location: string;
  frustration: string;
}) {
  return `
Write a follow-up email. First follow-up after no response to initial outreach.

Previous email subject: ${vars.previous_subject}
Previous email body: ${vars.previous_body}
Lead: ${vars.contact_name} at ${vars.company} (${vars.industry}, ${vars.location})
Their pain point: ${vars.frustration}

Rules:
- Keep it very short (2-3 sentences)
- Take a different angle from the first email
- Acknowledge they are busy
- Reference one specific thing from the original email
- End with a soft question, not a hard CTA
- Do not use buzzwords or em dashes

Return a JSON object with "subject", "body_html", and "body_text" fields.
`;
}

export function followup2Prompt(vars: {
  contact_name: string;
  company: string;
  frustration: string;
}) {
  return `
Write a final follow-up email. Second and last follow-up.

Lead: ${vars.contact_name} at ${vars.company}
Original topic: ${vars.frustration}

Rules:
- Maximum 2 sentences
- Be gracious, not pushy
- Leave the door open
- Do not use buzzwords or em dashes

Return a JSON object with "subject", "body_html", and "body_text" fields.
`;
}
