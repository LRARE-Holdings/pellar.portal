export function intentParsePrompt(vars: {
  frustration: string;
  offering_description: string;
  previous_subject: string;
  inbound_body: string;
}) {
  return `
Analyse this email response from a sales prospect.

Our original outreach was about: ${vars.frustration}
Our offering: ${vars.offering_description}
Our previous email subject: ${vars.previous_subject}

Their response:
---
${vars.inbound_body}
---

Return a JSON object with:
- intent: one of "meeting", "more_info", "not_interested", "out_of_office", "unclear"
- summary: one sentence describing what they want
- meeting_preference: if intent is "meeting", extract any time/date preferences. null otherwise.
- questions: array of any specific questions they asked. Empty array if none.
`;
}
